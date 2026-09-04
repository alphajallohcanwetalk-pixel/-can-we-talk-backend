import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';

import authRoutes from './routes/auth.js';
import bookRoutes from './routes/books.js';
import essayRoutes from './routes/essays.js';
import commentRoutes from './routes/comments.js';
import orderRoutes from './routes/orders.js';
import bookclubRoutes from './routes/bookclub.js';
import audiobookRoutes from './routes/audiobook.js';
import mediaRoutes from './routes/media.js';
import settingsRoutes from './routes/settings.js';
import webhookRoutes from './routes/webhooks.js';

const app = express();
app.set('trust proxy', 1);
app.use((req, res, next) => {
	const requestId = req.headers['x-request-id'] || crypto.randomUUID();
	req.requestId = requestId;
	res.setHeader('x-request-id', requestId);
	const startedAt = Date.now();
	res.on('finish', () => console.log(JSON.stringify({ type: 'request', request_id: requestId, method: req.method, path: req.path, status: res.statusCode, duration_ms: Date.now() - startedAt })));
	next();
});

const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
	const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_BOOKCLUB_MONTHLY', 'STRIPE_PRICE_BOOKCLUB_ANNUAL', 'FRONTEND_APP_URL'];
	const missing = required.filter((name) => !process.env[name]);
	const invalid = [process.env.STRIPE_SECRET_KEY, process.env.STRIPE_PRICE_BOOKCLUB_MONTHLY, process.env.STRIPE_PRICE_BOOKCLUB_ANNUAL].some((value) => value?.startsWith('sk_test_') || value?.startsWith('prod_'));
	if (missing.length || invalid) throw new Error(`Production configuration invalid${missing.length ? `; missing: ${missing.join(', ')}` : ''}${invalid ? '; Stripe must use live secret and price IDs' : ''}`);
}

const allowedOrigins = new Set([
	process.env.FRONTEND_URL,
	process.env.FRONTEND_APP_URL,
	'https://canwetalkvoice.com',
	'https://www.canwetalkvoice.com',
	...(isProduction ? [] : ['http://127.0.0.1:5500', 'http://localhost:5500'])
].filter(Boolean));

app.use(helmet({
	contentSecurityPolicy: false,
	crossOriginEmbedderPolicy: false
}));
app.use(cors({ origin: (origin, callback) => {
	if (!origin || allowedOrigins.has(origin)) return callback(null, true);
	return callback(null, false);
} }));

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false });
app.use('/api', apiLimiter);
app.use('/api/auth/welcome', rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false }));
app.use('/api/orders/checkout', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false }));

// Stripe webhooks need the RAW body for signature verification, so this must be
// registered BEFORE express.json() and only for this specific path.
app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhookRoutes);

app.use(express.json({ limit: '100kb' }));

app.use('/api/auth', authRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/essays', essayRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/bookclub', bookclubRoutes);
app.use('/api/audiobook', audiobookRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/settings', settingsRoutes);

app.get('/', (req, res) => res.json({
	name: 'Can We Talk? API',
	status: 'online',
	health: '/api/health'
}));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use((err, req, res, next) => {
	if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
		return res.status(400).json({ error: 'Invalid JSON' });
	}
	console.error(JSON.stringify({ type: 'error', request_id: req.requestId, message: err.message, path: req.path }));
	res.status(500).json({ error: 'Internal server error', request_id: req.requestId });
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Can We Talk? API running on port ${port}`));