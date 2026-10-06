import express from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { stripe } from '../lib/stripe.js';
import { requireAuth, requireAuthor } from '../middleware/auth.js';
import { stripDashes } from '../lib/validate.js';

const router = express.Router();

// Private bucket. Nothing in it is ever world readable; see migration 006.
const AUDIO_BUCKET = 'audiobook';

// GET /api/audiobook/:bookId/chapters: public: list chapters + whether current user owns each
router.get('/:bookId/chapters', async (req, res) => {
  const { data: chaptersData, error } = await supabaseAdmin
    .from('audiobook_chapters')
    .select('*')
    .eq('book_id', req.params.bookId)
    .order('sort_order');
  if (error) return res.status(500).json({ error: error.message });

  // If an Authorization header is present, mark which chapters are owned
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  let ownedIds = [];
  if (token) {
    const { data: userData } = await supabaseAdmin.auth.getUser(token);
    if (userData?.user) {
      const { data: purchases } = await supabaseAdmin
        .from('chapter_purchases')
        .select('chapter_id')
        .eq('user_id', userData.user.id);
      ownedIds = (purchases || []).map((p) => p.chapter_id);
    }
  }
  // audio_url is the paid asset. Never send it to someone who has not bought the
  // chapter: this endpoint is public, so selecting '*' was handing it out free.
  res.json(chaptersData.map((c) => {
    const owned = ownedIds.includes(c.id);
    const { audio_url, ...safe } = c;
    return owned ? { ...safe, audio_url, owned } : { ...safe, owned };
  }));
});

// POST /api/audiobook/chapters/:chapterId/buy: one-off Stripe Checkout for a single chapter
router.post('/chapters/:chapterId/buy', requireAuth, async (req, res) => {
  const { data: chapter } = await supabaseAdmin
    .from('audiobook_chapters')
    .select('*')
    .eq('id', req.params.chapterId)
    .single();
  if (!chapter) return res.status(404).json({ error: 'Chapter not found' });

  // Already bought: send them back instead of charging twice.
  const { data: owned } = await supabaseAdmin
    .from('chapter_purchases')
    .select('chapter_id')
    .eq('user_id', req.user.id)
    .eq('chapter_id', chapter.id)
    .maybeSingle();
  if (owned) return res.status(409).json({ error: 'You already own this chapter' });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: { currency: 'usd', product_data: { name: chapter.title }, unit_amount: chapter.price_cents },
        quantity: 1
      }],
      customer_email: req.user.email,
      metadata: { chapter_purchase_user_id: req.user.id, chapter_id: chapter.id },
      success_url: `${process.env.FRONTEND_APP_URL}#book-mrp?chapter_unlocked=1`,
      cancel_url: `${process.env.FRONTEND_APP_URL}#book-mrp`
    });
    res.json({ checkout_url: session.url });
  } catch (error) {
    console.error('Chapter checkout failed:', JSON.stringify({ type: error.type, code: error.code, message: error.message }));
    res.status(502).json({ error: 'Payment service unavailable' });
  }
});

// GET /api/audiobook/chapters/:chapterId/stream: signed URL, only if owned
router.get('/chapters/:chapterId/stream', requireAuth, async (req, res) => {
  const { data: owns } = await supabaseAdmin
    .from('chapter_purchases')
    .select('chapter_id')
    .eq('user_id', req.user.id)
    .eq('chapter_id', req.params.chapterId)
    .maybeSingle();
  if (!owns) return res.status(403).json({ error: 'Chapter not purchased' });

  const { data: chapter } = await supabaseAdmin
    .from('audiobook_chapters')
    .select('audio_url, audio_path')
    .eq('id', req.params.chapterId)
    .single();
  if (!chapter) return res.status(404).json({ error: 'Chapter not found' });

  // Preferred path: the file lives in the private `audiobook` bucket and is
  // handed out as a link that dies in an hour, so a shared URL does not become
  // a permanent free copy.
  if (chapter.audio_path) {
    const { data, error } = await supabaseAdmin
      .storage.from(AUDIO_BUCKET)
      .createSignedUrl(chapter.audio_path, 3600);
    if (error) return res.status(500).json({ error: 'Could not prepare the audio stream' });
    return res.json({ audio_url: data.signedUrl, expires_in: 3600 });
  }

  // Legacy rows that only carry a public URL.
  res.json({ audio_url: chapter.audio_url, expires_in: null });
});

// POST /api/audiobook/upload-url: mint a one-off signed upload URL.
// Narration files run to hundreds of megabytes, so the browser uploads straight
// to Storage. The API only decides whether the upload is allowed, it never
// carries the bytes.
router.post('/upload-url', requireAuth, requireAuthor, async (req, res) => {
  const { filename } = req.body || {};
  if (typeof filename !== 'string' || !filename.trim()) {
    return res.status(400).json({ error: 'filename is required' });
  }
  const safe = filename.trim().replace(/[^a-zA-Z0-9._-]/g, '').slice(-80) || 'chapter';
  const path = `chapters/${Date.now()}-${safe}`;

  const { data, error } = await supabaseAdmin.storage.from(AUDIO_BUCKET).createSignedUploadUrl(path);
  if (error) {
    const missingBucket = /bucket/i.test(error.message || '');
    return res.status(500).json({
      error: error.message,
      hint: missingBucket ? 'Run backend/migrations/006_media_buckets_and_video.sql in Supabase.' : undefined
    });
  }
  res.json({ path: data.path, token: data.token, signed_url: data.signedUrl, bucket: AUDIO_BUCKET });
});

// POST /api/audiobook/:bookId/chapters: Author Dashboard: add a narrated chapter
router.post('/:bookId/chapters', requireAuth, requireAuthor, async (req, res) => {
  const { title, duration_seconds, price_cents, audio_url, audio_path, sort_order, preview_seconds } = req.body;
  if (typeof title !== 'string' || !title.trim() || title.length > 300) {
    return res.status(400).json({ error: 'A chapter title is required' });
  }
  const price = Number(price_cents);
  if (!Number.isInteger(price) || price < 0) {
    return res.status(400).json({ error: 'price_cents must be a whole number of cents' });
  }
  if (!audio_path && !audio_url) {
    return res.status(400).json({ error: 'Upload the narration audio before publishing the chapter' });
  }

  const { data, error } = await supabaseAdmin
    .from('audiobook_chapters')
    .insert({
      book_id: req.params.bookId,
      title: stripDashes(title.trim()),
      duration_seconds: Number.isInteger(Number(duration_seconds)) ? Number(duration_seconds) : null,
      price_cents: price,
      audio_url: audio_path ? null : audio_url,
      audio_path: audio_path || null,
      preview_seconds: Number.isInteger(Number(preview_seconds)) ? Number(preview_seconds) : 0,
      sort_order: Number.isInteger(Number(sort_order)) ? Number(sort_order) : 0
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

// DELETE /api/audiobook/chapters/:chapterId
router.delete('/chapters/:chapterId', requireAuth, requireAuthor, async (req, res) => {
  const { data: chapter } = await supabaseAdmin
    .from('audiobook_chapters')
    .select('audio_path')
    .eq('id', req.params.chapterId)
    .maybeSingle();

  const { error } = await supabaseAdmin.from('audiobook_chapters').delete().eq('id', req.params.chapterId);
  if (error) return res.status(500).json({ error: error.message });

  // Drop the audio file too, so deleted chapters do not quietly keep billing
  // for storage.
  if (chapter?.audio_path) {
    await supabaseAdmin.storage.from(AUDIO_BUCKET).remove([chapter.audio_path]).catch(() => {});
  }
  res.status(204).send();
});

export default router;