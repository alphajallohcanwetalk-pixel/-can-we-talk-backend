import express from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireAuthor } from '../middleware/auth.js';

const router = express.Router();

// GET /api/books — public, powers the homepage grid
router.get('/', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('books')
    .select('id,title,subtitle,description,cover_style,cover_image_url,back_cover_url,gallery_urls,is_active,created_at,book_formats(*)')
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET /api/books/:id — single book detail
router.get('/:id', async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('books')
    .select('id,title,subtitle,description,cover_style,cover_image_url,back_cover_url,gallery_urls,is_active,created_at,book_formats(*)')
    .eq('id', req.params.id)
    .single();
  if (error) return res.status(404).json({ error: 'Book not found' });
  res.json(data);
});

router.get('/:id/manage', requireAuth, requireAuthor, async (req, res) => {
  const { data, error } = await supabaseAdmin.from('books').select('*, book_formats(*)').eq('id', req.params.id).single();
  if (error) return res.status(404).json({ error: 'Book not found' });
  res.json(data);
});

// POST /api/books — Author Dashboard: add a new book
router.post('/', requireAuth, requireAuthor, async (req, res) => {
  const { title, subtitle, description, cover_style, cover_image_url, back_cover_url, gallery_urls, reader_full_text, formats } = req.body;
  if (typeof title !== 'string' || !title.trim() || typeof description !== 'string' || !description.trim()) return res.status(400).json({ error: 'Title and description are required' });
  const { data: existing } = await supabaseAdmin.from('books').select('id').ilike('title', title.trim()).limit(1).maybeSingle();
  if (existing) return res.status(409).json({ error: 'A book with this title already exists. Edit the existing book instead.' });
  const { data: book, error } = await supabaseAdmin
    .from('books')
    .insert({ title, subtitle, description, cover_style, cover_image_url, back_cover_url, gallery_urls, reader_full_text })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  if (Array.isArray(formats) && formats.length) {
    const rows = formats.map((f) => ({ ...f, book_id: book.id }));
    await supabaseAdmin.from('book_formats').insert(rows);
  }
  res.status(201).json(book);
});

// PUT /api/books/:id — edit
router.put('/:id', requireAuth, requireAuthor, async (req, res) => {
  const { price, ...bookFields } = req.body;
  const { data, error } = await supabaseAdmin
    .from('books')
    .update(bookFields)
    .eq('id', req.params.id)
    .select()
    .single();
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

// POST /api/books/:id/formats — add a new format (e.g. Hardcover) to a book
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

// PUT /api/books/formats/:formatId — edit a format's name/price/availability
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
    // Past orders reference this exact format — can't delete without breaking their
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
    // Foreign key violation (code 23503) means this book has real orders attached —
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