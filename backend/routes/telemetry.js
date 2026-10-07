import express from 'express';
import { logAppError } from '../lib/errorLog.js';

const router = express.Router();

// Public browser error reporting.
//
// This has to be open, because the errors worth knowing about are the ones
// happening to readers, not to the developer. An authenticated endpoint would
// only ever capture failures for the one person least likely to hit them.
//
// Being open makes it a target, so it is deliberately cheap to refuse and
// impossible to use as storage:
//   * rate limited per address, in server.js
//   * every field is length capped before it reaches the database
//   * only the fields below are read; anything else in the body is discarded
//   * no response body worth harvesting
const MAX_MESSAGE = 1000;
const MAX_STACK = 4000;
const MAX_PATH = 300;

const clip = (value, limit) =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, limit) : null;

router.post('/client-error', async (req, res) => {
  const message = clip(req.body?.message, MAX_MESSAGE);
  if (!message) return res.status(400).json({ error: 'message is required' });

  // Context is free-form from the browser, so only a few known keys are kept
  // and each is clipped. Storing it wholesale would let anyone write arbitrary
  // JSON into the log.
  const raw = req.body?.context;
  const context = {};
  if (raw && typeof raw === 'object') {
    for (const key of ['line', 'col', 'file', 'kind']) {
      if (raw[key] !== undefined && raw[key] !== null) {
        context[key] = typeof raw[key] === 'number' ? raw[key] : clip(String(raw[key]), 200);
      }
    }
  }

  await logAppError({
    error: { message, stack: clip(req.body?.stack, MAX_STACK) },
    req: { ...req, path: clip(req.body?.path, MAX_PATH) || req.path },
    status: 0,
    source: 'client',
    context
  });

  // 204: nothing to say, and nothing for an attacker to measure.
  res.status(204).send();
});

export default router;
