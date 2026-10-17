// When each kind of public content last changed, so open pages refresh within seconds of an edit or
// a deletion instead of waiting for their next timed reload. Kept in memory: a restart marks
// everything as changed once, which only makes open pages fetch fresh copies.
const started = Date.now();
const stamps = { gallery: started, books: started, essays: started, settings: started };

export function markChanged(kind) {
  if (kind in stamps) stamps[kind] = Date.now();
}

export function changes() {
  return { ...stamps };
}

// Marks a kind as changed after any successful write under its route.
export function trackChanges(kind) {
  return (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.on('finish', () => { if (res.statusCode < 400) markChanged(kind); });
    }
    next();
  };
}
