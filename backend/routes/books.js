import express from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireAuthor } from '../middleware/auth.js';
import { normalizeVideoList, cleanTextFields, stripDashes } from '../lib/validate.js';

const router = express.Router();

// Columns returned to the public site. The bibliographic ones arrive with
// migration 010; selectBooks falls back if it has not been run yet.
const BOOK_SELECT = 'id,title,subtitle,description,cover_style,cover_image_url,back_cover_url,gallery_urls,video_urls,is_active,created_at,isbn,publisher,published_date,page_count,language,genre,edition,book_formats(*)';
const BOOK_SELECT_LEGACY = 'id,title,subtitle,description,cover_style,cover_image_url,back_cover_url,gallery_urls,video_urls,is_active,created_at,book_formats(*)';


// Runs a books query with the full column list, and retries without the
// bibliographic columns if migration 010 has not been applied. Without this the
// whole catalogue would 500 in the window between deploying and migrating.
async function selectBooks(build) {
  let result = await build(BOOK_SELECT);
  if (result.error && /column .* does not exist|isbn|publisher|published_date|page_count|edition/i.test(result.error.message || '')) {
    result = await build(BOOK_SELECT_LEGACY);
  }
  return result;
}

// GET /api/books: public, powers the homepage grid
router.get('/', async (req, res) => {
  const { data, error } = await selectBooks((cols) => supabaseAdmin
    .from('books')
    .select(cols)
    .eq('is_active', true)
    .order('created_at', { ascending: false }));
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/books/:id: single book detail
router.get('/:id', async (req, res) => {
  const { data, error } = await selectBooks((cols) => supabaseAdmin
    .from('books')
    .select(cols)
    .eq('id', req.params.id)
    .single());
  if (error) return res.status(404).json({ error: 'Book not found' });
  res.json(data);
});

router.get('/:id/manage', requireAuth, requireAuthor, async (req, res) => {
  const { data, error } = await supabaseAdmin.from('books').select('*, book_formats(*)').eq('id', req.params.id).single();
  if (error) return res.status(404).json({ error: 'Book not found' });
  res.json(data);
});

// POST /api/books: Author Dashboard: add a new book
router.post('/', requireAuth, requireAuthor, async (req, res) => {
  const { title, subtitle, description, cover_style, cover_image_url, back_cover_url, gallery_urls, reader_full_text, formats, video_urls,
    isbn, publisher, published_date, page_count, language, genre, edition } = req.body;
  if (typeof title !== 'string' || !title.trim() || typeof description !== 'string' || !description.trim()) return res.status(400).json({ error: 'Title and description are required' });
  const { data: existing } = await supabaseAdmin.from('books').select('id').ilike('title', title.trim()).limit(1).maybeSingle();
  if (existing) return res.status(409).json({ error: 'A book with this title already exists. Edit the existing book instead.' });
  const { data: book, error } = await supabaseAdmin
    .from('books')
    .insert(normalizeBookMeta(cleanTextFields({
      title, subtitle, description, cover_style, cover_image_url, back_cover_url, gallery_urls, reader_full_text,
      video_urls: normalizeVideoList(video_urls) ?? [],
      isbn, publisher, published_date, page_count, language, genre, edition
    }, ['title', 'subtitle', 'description', 'reader_full_text', 'publisher', 'genre', 'edition'])))
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  // Formats come from a form, so only the known columns are taken. Spreading
  // the submitted object would let an unexpected key through to the insert.
  // Anything without a usable name and price is skipped rather than failing
  // the whole book.
  const formatRows = (Array.isArray(formats) ? formats : [])
    .map((f, index) => ({
      book_id: book.id,
      format_name: typeof f?.format_name === 'string' ? stripDashes(f.format_name.trim()) : '',
      price_cents: Number(f?.price_cents),
      stock_count: Number.isInteger(Number(f?.stock_count)) ? Number(f.stock_count) : null,
      sort_order: Number.isInteger(Number(f?.sort_order)) ? Number(f.sort_order) : index,
      is_offered: f?.is_offered !== false
    }))
    .filter((f) => f.format_name && Number.isInteger(f.price_cents) && f.price_cents >= 0);

  if (formatRows.length) {
    const { error: formatError } = await supabaseAdmin.from('book_formats').insert(formatRows);
    // The book exists either way; report the problem rather than leaving the
    // author thinking the prices saved.
    if (formatError) {
      return res.status(201).json({ ...book, formats_warning: formatError.message });
    }
  }
  res.status(201).json(book);
});

// PUT /api/books/:id: edit
const BOOK_FIELDS = ['title', 'subtitle', 'description', 'cover_style', 'cover_image_url',
  'back_cover_url', 'gallery_urls', 'reader_full_text', 'is_active', 'video_urls',
  'isbn', 'publisher', 'published_date', 'page_count', 'language', 'genre', 'edition'];

// Bibliographic fields arrive from a form, so blanks come through as empty
// strings. Those must become null rather than being stored, or the ISBN unique
// index would treat every book without one as a duplicate.
function normalizeBookMeta(fields) {
  for (const key of ['isbn', 'publisher', 'language', 'genre', 'edition']) {
    if (typeof fields[key] === 'string') {
      const trimmed = fields[key].trim();
      fields[key] = trimmed === '' ? null : trimmed;
    }
  }
  if (fields.published_date !== undefined) {
    const value = String(fields.published_date || '').trim();
    fields.published_date = value === '' ? null : value;
  }
  if (fields.page_count !== undefined) {
    const n = Number(fields.page_count);
    fields.page_count = Number.isInteger(n) && n > 0 ? n : null;
  }
  return fields;
}

router.put('/:id', requireAuth, requireAuthor, async (req, res) => {
  const { price } = req.body;
  // Only the known columns are forwarded. Spreading the body let an unexpected
  // key through to the update and failed the whole request on a typo.
  const bookFields = {};
  for (const field of BOOK_FIELDS) {
    if (req.body[field] !== undefined) bookFields[field] = req.body[field];
  }
  // Video links are pasted as free text, so normalise them into the stored shape.
  if (bookFields.video_urls !== undefined) {
    bookFields.video_urls = normalizeVideoList(bookFields.video_urls);
  }
  // House style: no dashes in published copy.
  cleanTextFields(bookFields, ['title', 'subtitle', 'description', 'reader_full_text',
    'publisher', 'genre', 'edition']);
  normalizeBookMeta(bookFields);
  if (!Object.keys(bookFields).length && price === undefined) {
    return res.status(400).json({ error: 'No book fields to update' });
  }

  // A price-only edit has no book columns to write, and an empty update is an
  // error, so just read the row back in that case.
  const query = Object.keys(bookFields).length
    ? supabaseAdmin.from('books').update(bookFields).eq('id', req.params.id).select().single()
    : supabaseAdmin.from('books').select().eq('id', req.params.id).single();
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  if (price !== undefined) {
    const priceCents = Math.round(Number(price) * 100);
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      return res.status(400).json({ error: 'price must be a non-negative number' });
    }

    const { data: paperback, error: formatError } = await supabaseAdmin
      .from('book_formats')
      .select('id')
      .eq('book_id', req.params.id)
      .eq('format_name', 'Paperback')
      .maybeSingle();

    if (formatError) return res.status(500).json({ error: formatError.message });

    const formatQuery = paperback
      ? supabaseAdmin.from('book_formats').update({ price_cents: priceCents }).eq('id', paperback.id)
      : supabaseAdmin.from('book_formats').insert({
          book_id: req.params.id,
          format_name: 'Paperback',
          price_cents: priceCents,
          sort_order: 0
        });
    const { error: savePriceError } = await formatQuery;
    if (savePriceError) return res.status(500).json({ error: savePriceError.message });
  }

  res.json(data);
});

// POST /api/books/:id/formats: add a new format (e.g. Hardcover) to a book
router.post('/:id/formats', requireAuth, requireAuthor, async (req, res) => {
  const { format_name, price_cents } = req.body;
  const { data, error } = await supabaseAdmin
    .from('book_formats')
    .insert({ book_id: req.params.id, format_name, price_cents, sort_order: 99, is_offered: true })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// PUT /api/books/formats/:formatId: edit a format's name/price/availability
router.put('/formats/:formatId', requireAuth, requireAuthor, async (req, res) => {
  const { format_name, price_cents, is_offered } = req.body;
  const { data, error } = await supabaseAdmin
    .from('book_formats')
    .update({ format_name, price_cents, is_offered })
    .eq('id', req.params.formatId)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// DELETE /api/books/formats/:formatId
router.delete('/formats/:formatId', requireAuth, requireAuthor, async (req, res) => {
  const { error } = await supabaseAdmin.from('book_formats').delete().eq('id', req.params.formatId);
  if (error) {
    // Past orders reference this exact format, can't delete without breaking their
    // history, so hide it from sale instead.
    if (error.code === '23503') {
      const { error: updateError } = await supabaseAdmin
        .from('book_formats')
        .update({ is_offered: false })
        .eq('id', req.params.formatId);
      if (updateError) return res.status(500).json({ error: updateError.message });
      return res.json({ unpublished: true, message: 'This format has existing orders, so it was hidden from sale instead of deleted.' });
    }
    return res.status(500).json({ error: error.message });
  }
  res.status(204).send();
});

// DELETE /api/books/:id
router.delete('/:id', requireAuth, requireAuthor, async (req, res) => {
  const { error } = await supabaseAdmin.from('books').delete().eq('id', req.params.id);

  if (error) {
    // Foreign key violation (code 23503) means this book has real orders attached, 
    // deleting it would corrupt those order records. Unpublish it instead: it disappears
    // from the store immediately, but order history stays intact.
    if (error.code === '23503') {
      const { error: updateError } = await supabaseAdmin
        .from('books')
        .update({ is_active: false })
        .eq('id', req.params.id);
      if (updateError) return res.status(500).json({ error: updateError.message });
      return res.json({ unpublished: true, message: 'This book has existing orders, so it was unpublished from the store instead of deleted, to keep past order records intact.' });
    }
    return res.status(500).json({ error: error.message });
  }

  res.status(204).send();
});

export default router;