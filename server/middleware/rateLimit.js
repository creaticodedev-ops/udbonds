const store = new Map();

const prune = (key, windowMs) => {
  const now = Date.now();
  const hits = store.get(key) || [];
  const fresh = hits.filter((ts) => now - ts < windowMs);
  if (fresh.length) store.set(key, fresh);
  else store.delete(key);
  return fresh;
};

export const rateLimit = ({ windowMs = 60_000, max = 60, message = 'Too many requests, please try again later' } = {}) => {
  return (req, res, next) => {
    const key = `${req.ip}:${req.baseUrl}${req.path}`;
    const hits = prune(key, windowMs);
    if (hits.length >= max) {
      return res.status(429).json({ success: false, message });
    }
    hits.push(Date.now());
    store.set(key, hits);
    next();
  };
};
