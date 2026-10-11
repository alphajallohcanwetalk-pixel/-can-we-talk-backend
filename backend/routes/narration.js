import express from 'express';
import { supabaseAdmin } from '../lib/supabase.js';
import { requireAuth, requireAuthor } from '../middleware/auth.js';
import { announce } from '../lib/push.js';

// Narration in the author's own voice.
//
// The voice is a clone made once in ElevenLabs from a recording of Alpha
// reading (see docs/voice-narration.md). With it, an essay becomes a real MP3:
// the same voice on every phone and laptop, and playable offline once saved,
// which the voices built into each device cannot offer.
//
// Needs ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID on the server. Without them
// the dashboard simply does not offer the button.

const router = express.Router();
const KEY = process.env.ELEVENLABS_API_KEY || '';
const VOICE = process.env.ELEVENLABS_VOICE_ID || '';
const MODEL = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';
const enabled = () => Boolean(KEY && VOICE);

// Work runs after the response, so the author is not left waiting on a page
// for several minutes. Progress is kept in memory; a restart only loses the
// progress note, never a finished file.
const jobs = new Map();

// ElevenLabs takes a few thousand characters per request. Split on paragraphs,
// then sentences, so no request ends part way through a sentence.
function chunk(text, max = 4200) {
  const out = [];
  let buf = '';
  const push = () => { if (buf.trim()) out.push(buf.trim()); buf = ''; };
  for (const para of text.split(/\n\s*\n/)) {
    if ((buf + '\n\n' + para).length <= max) { buf += (buf ? '\n\n' : '') + para; continue; }
    push();
    if (para.length <= max) { buf = para; continue; }
    for (const sentence of para.match(/[^.!?]+[.!?]*["'”’)]*\s*/g) || [para]) {
      if ((buf + sentence).length > max) push();
      buf += sentence;
    }
  }
  push();
  return out;
}

async function speak(text, previous, next) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({
      text,
      model_id: MODEL,
      previous_text: previous || undefined,
      next_text: next || undefined,
      voice_settings: { stability: 0.55, similarity_boost: 0.85, style: 0.15, use_speaker_boost: true },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Voice service answered ${res.status}${detail ? ': ' + detail.slice(0, 200) : ''}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

async function narrateEssay(id) {
  const job = jobs.get(id);
  try {
    const { data: essay, error } = await supabaseAdmin.from('essays').select('id,title,full_text,excerpt,audio_url,cover_image_url').eq('id', id).single();
    if (error || !essay) throw new Error('Essay not found');
    const body = (essay.full_text && essay.full_text.trim()) ? essay.full_text : essay.excerpt || '';
    if (!body.trim()) throw new Error('This essay has no text to read');

    const parts = chunk(`${essay.title}.\n\nBy Alpha Amadu Jalloh.\n\n${body}`);
    job.total = parts.length;
    const audio = [];
    for (let i = 0; i < parts.length; i++) {
      job.done = i;
      audio.push(await speak(parts[i], parts[i - 1]?.slice(-400), parts[i + 1]?.slice(0, 400)));
    }
    job.done = parts.length;

    // MP3 frames can be joined end to end.
    const file = Buffer.concat(audio);
    const path = `narration/essay-${id}-${Date.now()}.mp3`;
    const { error: upErr } = await supabaseAdmin.storage.from('media').upload(path, file, { contentType: 'audio/mpeg', upsert: true });
    if (upErr) throw new Error('Could not store the audio: ' + upErr.message);
    const { data: pub } = supabaseAdmin.storage.from('media').getPublicUrl(path);

    const seconds = Math.round((file.length * 8) / 128000);
    const { error: saveErr } = await supabaseAdmin.from('essays').update({ audio_url: pub.publicUrl, audio_seconds: seconds }).eq('id', id);
    if (saveErr) throw new Error('Audio made but not saved: ' + saveErr.message);

    if (!essay.audio_url) {
      announce({ title: 'New audio essay', body: essay.title, url: `/#essay-${id}`, image: essay.cover_image_url || null });
    }
    job.status = 'done';
    job.audio_url = pub.publicUrl;
  } catch (err) {
    job.status = 'failed';
    job.error = err.message;
    console.error(JSON.stringify({ type: 'error', scope: 'narration', essay_id: id, message: err.message }));
  }
}

router.get('/config', requireAuth, requireAuthor, (req, res) => res.json({ enabled: enabled() }));

router.post('/essay/:id', requireAuth, requireAuthor, (req, res) => {
  if (!enabled()) return res.status(503).json({ error: 'Narration in your voice is not set up yet' });
  const existing = jobs.get(req.params.id);
  if (existing && existing.status === 'running') return res.status(202).json(existing);
  const job = { status: 'running', done: 0, total: 0, started_at: new Date().toISOString() };
  jobs.set(req.params.id, job);
  narrateEssay(req.params.id);
  res.status(202).json(job);
});

router.get('/essay/:id', requireAuth, requireAuthor, (req, res) => {
  res.json(jobs.get(req.params.id) || { status: 'idle' });
});

export default router;
