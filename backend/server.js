import 'dotenv/config';
import express from 'express';
import cors from 'cors';

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

const allowedOrigins = new Set([
	process.env.FRONTEND_URL,
	process.env.FRONTEND_APP_URL,
	'https://canwetalkvoice.com',
	'https://www.canwetalkvoice.com',
	'http://127.0.0.1:5500',
	'http://localhost:5500'
].filter(Boolean));

app.use(cors({ origin: (origin, callback) => {
	if (!origin || allowedOrigins.has(origin)) return callback(null, true);
	return callback(new Error('Origin not allowed by CORS'));
} }));

// Stripe webhooks need the RAW body for signature verification, so this must be
// registered BEFORE express.json() and only for this specific path.
app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhookRoutes);

app.use(express.json());

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

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Can We Talk? API running on port ${port}`));