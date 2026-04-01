/**
 * src/routes/documentRoutes.js
 *
 * Handles PDF generation and email sending for:
 *   POST /api/jobs/:id/quote/pdf      → generate & stream quote PDF
 *   POST /api/jobs/:id/quote/email    → generate & email quote
 *   POST /api/jobs/:id/invoice/:invId/pdf   → generate & stream invoice PDF
 *   POST /api/jobs/:id/invoice/:invId/email → generate & email invoice
 *
 * Dependencies (install in Backened):
 *   npm install python-shell nodemailer
 *   pip install reportlab
 *
 * Set these in your .env:
 *   SMTP_HOST=smtp.gmail.com
 *   SMTP_PORT=587
 *   SMTP_USER=your@gmail.com
 *   SMTP_PASS=your-app-password
 *   SMTP_FROM="Flooring Junction <your@gmail.com>"
 */

const express  = require('express');
const router   = express.Router();
const path     = require('path');
const fs       = require('fs');
const os       = require('os');
const { PythonShell }  = require('python-shell');
const nodemailer       = require('nodemailer');
const prisma           = require('../utils/prisma');

// ── Email transporter ─────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST || 'smtp.gmail.com',
  port:   parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ── Helper: run Python PDF generator ─────────────────────────────────────────
function generatePDF(scriptName, jobData) {
  return new Promise((resolve, reject) => {
    const outPath = path.join(os.tmpdir(), `${scriptName}_${Date.now()}.pdf`);
    jobData.output_path = outPath;

    PythonShell.run(
      path.join(__dirname, '..', 'utils', `${scriptName}.py`),
      { args: [JSON.stringify(jobData)], pythonPath: 'python3' },
      (err, results) => {
        if (err) return reject(err);
        const ok = (results || []).find(r => r.startsWith('OK:'));
        if (!ok) return reject(new Error('PDF script did not return OK'));
        resolve(outPath);
      }
    );
  });
}

// ── Helper: build quote payload from job ─────────────────────────────────────
async function buildQuotePayload(jobId) {
  const job = await prisma.job.findUnique({
    where: { id: parseInt(jobId) },
    include: {
      customer: true,
      lineItems: { orderBy: { sortOrder: 'asc' } },
    },
  });
  if (!job) throw new Error('Job not found');

  const count = await prisma.job.count({ where: { id: { lte: job.id } } });

  return {
    quote_number:    `Q-${String(job.id).padStart(5, '0')}`,
    quote_date:      new Date().toLocaleDateString('en-AU'),
    customer_name:   job.customer?.name || job.title,
    customer_state:  job.siteState || '',
    customer_country:job.siteCountry || 'Australia',
    customer_email:  job.customer?.email || job.contactEmail || '',
    site_address:    job.siteStreet || '',
    site_suburb:     job.siteTown || '',
    site_state:      job.siteState || '',
    site_country:    job.siteCountry || 'Australia',
    rep_name:        '',
    rep_location:    'Hallam',
    gst_rate:        (job.gstRate || 10) / 100,
    line_items:      job.lineItems
      .filter(li => !li.isHeader)
      .map(li => ({
        description: li.description,
        qty:         li.qty,
        unit_sell:   li.unitSell,
        is_header:   li.isHeader,
      })),
    _job: job,
  };
}

// ── Helper: build invoice payload ────────────────────────────────────────────
async function buildInvoicePayload(jobId, invId) {
  const job = await prisma.job.findUnique({
    where: { id: parseInt(jobId) },
    include: { customer: true, lineItems: { orderBy: { sortOrder: 'asc' } } },
  });
  const invoice = await prisma.invoice.findUnique({
    where: { id: parseInt(invId) },
    include: { payments: { orderBy: { paidOn: 'asc' } } },
  });
  if (!job || !invoice) throw new Error('Job or invoice not found');

  return {
    invoice_number:    invoice.invoiceNumber,
    invoice_date:      new Date(invoice.invoiceDate).toLocaleDateString('en-AU'),
    customer_name:     job.customer?.name || job.title,
    billing_street:    job.billingStreet || job.siteStreet || '',
    billing_town:      job.billingTown   || job.siteTown   || '',
    billing_state:     job.billingState  || job.siteState  || '',
    billing_zip:       job.billingZip    || job.siteZip    || '',
    billing_country:   job.billingCountry || 'Australia',
    site_street:       job.siteStreet    || '',
    site_town:         job.siteTown      || '',
    site_state:        job.siteState     || '',
    site_zip:          job.siteZip       || '',
    contact_phone:     job.contactPhone  || job.customer?.phone || '',
    contact_email:     job.contactEmail  || job.customer?.email || '',
    job_ref:           job.jobRef        || '',
    gst_rate:          (job.gstRate || 10) / 100,
    gross_amount:      invoice.grossAmount,
    credit:            invoice.credit,
    retention_release: invoice.retentionRelease,
    line_items:        job.lineItems.map(li => ({
      description: li.description,
      qty:         li.qty,
      unit_sell:   li.unitSell,
      is_header:   li.isHeader,
    })),
    payments: invoice.payments.map(p => ({
      paid_on:   new Date(p.paidOn).toLocaleDateString('en-AU'),
      amount:    p.amount,
      method:    p.method,
      reference: p.reference,
    })),
    _job:     job,
    _invoice: invoice,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
//  QUOTE ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/jobs/:id/quote/pdf  → stream PDF to browser
router.post('/:id/quote/pdf', async (req, res) => {
  try {
    const payload  = await buildQuotePayload(req.params.id);
    const pdfPath  = await generatePDF('generate_quote', payload);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Quote-${payload.quote_number}.pdf"`);
    fs.createReadStream(pdfPath).pipe(res).on('finish', () => fs.unlink(pdfPath, () => {}));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/jobs/:id/quote/email  → email the quote PDF
router.post('/:id/quote/email', async (req, res) => {
  try {
    const { to, subject, body } = req.body;
    const payload  = await buildQuotePayload(req.params.id);
    const pdfPath  = await generatePDF('generate_quote', payload);

    const emailTo = to || payload._job.customer?.email || payload._job.contactEmail;
    if (!emailTo) return res.status(400).json({ error: 'No recipient email address found' });

    await transporter.sendMail({
      from:        process.env.SMTP_FROM || process.env.SMTP_USER,
      to:          emailTo,
      subject:     subject || `Quote ${payload.quote_number} — Flooring Junction`,
      text:        body   || `Please find attached your quote ${payload.quote_number}.\n\nThank you for choosing Flooring Junction.`,
      attachments: [{ filename: `Quote-${payload.quote_number}.pdf`, path: pdfPath }],
    });

    fs.unlink(pdfPath, () => {});

    // Mark sent on job timeline
    await prisma.timeline.create({
      data: { jobId: parseInt(req.params.id), message: `Quote ${payload.quote_number} emailed to ${emailTo}` },
    });

    res.json({ ok: true, sentTo: emailTo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  INVOICE ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/jobs/:id/invoice/:invId/pdf  → stream invoice PDF
router.post('/:id/invoice/:invId/pdf', async (req, res) => {
  try {
    const payload = await buildInvoicePayload(req.params.id, req.params.invId);
    const pdfPath = await generatePDF('generate_invoice', payload);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Invoice-${payload.invoice_number}.pdf"`);
    fs.createReadStream(pdfPath).pipe(res).on('finish', () => fs.unlink(pdfPath, () => {}));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/jobs/:id/invoice/:invId/email  → email invoice PDF
router.post('/:id/invoice/:invId/email', async (req, res) => {
  try {
    const { to, subject, body } = req.body;
    const payload = await buildInvoicePayload(req.params.id, req.params.invId);
    const pdfPath = await generatePDF('generate_invoice', payload);

    const emailTo = to || payload._job.customer?.email || payload._job.contactEmail;
    if (!emailTo) return res.status(400).json({ error: 'No recipient email address found' });

    await transporter.sendMail({
      from:        process.env.SMTP_FROM || process.env.SMTP_USER,
      to:          emailTo,
      subject:     subject || `Invoice ${payload.invoice_number} — Flooring Junction`,
      text:        body    || `Please find attached your invoice ${payload.invoice_number}.\n\nThank you for your business.`,
      attachments: [{ filename: `Invoice-${payload.invoice_number}.pdf`, path: pdfPath }],
    });

    fs.unlink(pdfPath, () => {});

    // Mark invoice as sent
    await prisma.invoice.update({
      where: { id: parseInt(req.params.invId) },
      data:  { sent: true, sentAt: new Date() },
    });
    await prisma.timeline.create({
      data: { jobId: parseInt(req.params.id), message: `Invoice ${payload.invoice_number} emailed to ${emailTo}` },
    });

    res.json({ ok: true, sentTo: emailTo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
