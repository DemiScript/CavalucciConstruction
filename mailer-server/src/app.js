import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import cors from 'cors';
import contactRouter from './routes/contact.js';
import errorHandler from './middleware/errorHandler.js';

const app = express();

// Render (and most hosts) run the app behind a single reverse proxy. Trusting
// one hop lets express-rate-limit read the real client IP from X-Forwarded-For
// instead of lumping every visitor under the proxy's IP. Harmless locally.
app.set('trust proxy', 1);

// In production, restrict to the configured frontend origin(s). Comma-separate
// to allow more than one (e.g. apex + www). When CORS_ORIGIN is unset (local
// dev), `true` reflects the request origin so any localhost port just works.
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
  : true;

// Middleware order matters: security headers → logging → CORS → body parsing.
app.use(helmet());
app.use(morgan('dev'));
app.use(cors({ origin: corsOrigin, methods: ['POST'] }));
app.use(express.json());

// Health check — lets you (and Render) confirm the server is up at the base URL.
app.get('/', (req, res) => res.json({ status: 'ok', service: 'mailer-server' }));

// Routes
app.use('/api/contact', contactRouter);

// Error handler must be mounted last.
app.use(errorHandler);

export default app;
