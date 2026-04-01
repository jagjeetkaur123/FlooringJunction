'use strict';

/**
 * src/routes/billingRoutes.js
 *
 * Mounted at /api/billing
 *
 * GET    /api/billing/jobs/:jobId/invoices          — list invoices for a job
 * POST   /api/billing/jobs/:jobId/invoices          — create invoice from a job
 * GET    /api/billing/invoices/:id                  — get invoice (with payments & job)
 * PUT    /api/billing/invoices/:id                  — update invoice amounts / dates
 * DELETE /api/billing/invoices/:id                  — delete invoice
 * POST   /api/billing/invoices/:id/payments         — record a payment
 * DELETE /api/billing/invoices/:id/payments/:payId  — remove a payment
 */

const express = require('express');
const router  = express.Router();
const c       = require('../controllers/billingController');

// ── Invoices ──────────────────────────────────────────────────────────────────
router.get('/jobs/:jobId/invoices',  c.listInvoices);
router.post('/jobs/:jobId/invoices', c.createInvoice);

router.get('/invoices/:id',    c.getInvoice);
router.put('/invoices/:id',    c.updateInvoice);
router.delete('/invoices/:id', c.deleteInvoice);

// ── Payments ──────────────────────────────────────────────────────────────────
router.post('/invoices/:id/payments',          c.createPayment);
router.delete('/invoices/:id/payments/:payId', c.deletePayment);

module.exports = router;
