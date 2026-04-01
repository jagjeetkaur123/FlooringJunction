'use strict';

require('dotenv').config();

const express = require('express');
const morgan  = require('morgan');
const cors    = require('cors');

const { logger }                         = require('./src/utils/logger');
const { NODE_ENV, APP_PORT, CORS_ORIGINS } = require('./src/config/config');
const errorHandler                       = require('./src/middleware/errorHandler');

// ── Route imports ────────────────────────────────────────────
const routes         = require('./src/routes');
const userRoutes     = require('./src/routes/userRoutes');
const jobRoutes      = require('./src/routes/jobRoutes');
const documentRoutes = require('./src/routes/documentRoutes');
const billingRoutes  = require('./src/routes/billingRoutes');
const invoicePdfRoute = require('./src/routes/invoicePdRoute');
const quoteRoute     = require('./src/routes/quoteRoute');
const costSellRoutes  = require('./src/routes/costSellRoutes');
const scheduleRoutes  = require('./src/routes/scheduleRoutes');
const mediaRoutes     = require('./src/routes/mediaRoutes');
const productRoutes   = require('./src/routes/productRoutes');
const loanRoutes      = require('./src/routes/loanRoutes');

// ── App ──────────────────────────────────────────────────────
const app = express();

// ── Middleware ───────────────────────────────────────────────
app.use(cors({
  origin: CORS_ORIGINS,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev', { stream: logger.stream }));

// ── Routes ───────────────────────────────────────────────────
app.use('/api',         routes);
app.use('/api/users',   userRoutes);
app.use('/api/jobs',    jobRoutes);
app.use('/api/jobs',    documentRoutes);
app.use('/api/jobs',    quoteRoute);
app.use('/api/jobs',    costSellRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/billing', invoicePdfRoute);
app.use('/api/jobs',    scheduleRoutes);
app.use('/api/jobs',      mediaRoutes);
app.use('/api/products',  productRoutes);
app.use('/api/loans',     loanRoutes);

// ── Health check ─────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Error handler (must be last) ─────────────────────────────
app.use(errorHandler);

// ── Process-level error guards ────────────────────────────────
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { message: err.message, stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: String(reason) });
  process.exit(1);
});

// ── Start ────────────────────────────────────────────────────
const server = app.listen(APP_PORT, () => {
  logger.info(`Server running in ${NODE_ENV} mode on port ${APP_PORT}`);
});

// ── Graceful shutdown ────────────────────────────────────────
function shutdown(signal) {
  logger.info(`${signal} received — shutting down gracefully`);
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  // Force exit if still open after 10 s
  setTimeout(() => {
    logger.error('Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
