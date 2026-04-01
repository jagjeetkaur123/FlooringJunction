'use strict';

/**
 * src/routes/invoicePdRoute.js
 *
 * Mounted at /api/billing
 *
 * POST /api/billing/invoices/:id/pdf    — stream tax invoice PDF to browser / printer
 * POST /api/billing/invoices/:id/email  — generate PDF and email to customer
 */

const express      = require('express');
const router       = express.Router();
const path         = require('path');
const fs           = require('fs');
const os           = require('os');
const { PythonShell }  = require('python-shell');
const nodemailer       = require('nodemailer');
const prisma           = require('../utils/prisma');

// ── Email transporter ─────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST || 'smtp.gmail.com',
  port:   parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

// ── Helper: run Python PDF generator ─────────────────────────────────────────
function generatePDF(scriptName, data) {
  return new Promise((resolve, reject) => {
    const outPath = path.join(os.tmpdir(), `${scriptName}_${Date.now()}.pdf`);
    data.output_path = outPath;
    PythonShell.run(
      path.join(__dirname, '..', 'utils', `${scriptName}.py`),
      { args: [JSON.stringify(data)], pythonPath: 'python3' },
      (err, results) => {
        if (err) return reject(err);
        const ok = (results || []).find(r => r.startsWith('OK:'));
        if (!ok) return reject(new Error('PDF script did not return OK'));
        resolve(outPath);
      }
    );
  });
}

// ── Helper: build full invoice payload ───────────────────────────────────────
async function buildPayload(invId) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: parseInt(invId) },
    include: {
      payments: { orderBy: { paidOn: 'asc' } },
      job: {
        include: {
          customer: true,
          lineItems: { orderBy: { sortOrder: 'asc' } },
        },
      },
    },
  });
  if (!invoice) throw new Error('Invoice not found');

  const { job } = invoice;
  const totalPaid   = invoice.payments.reduce((s, p) => s + p.amount, 0);
  const balanceDue  = Math.max(0, invoice.totalAmount - totalPaid);

  return {
    invoice_number:    invoice.invoiceNumber,
    invoice_date:      new Date(invoice.invoiceDate).toLocaleDateString('en-AU'),
    due_date:          invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-AU') : '',
    customer_name:     job.customer?.name || job.title,
    billing_street:    job.billingStreet  || job.siteStreet  || '',
    billing_town:      job.billingTown    || job.siteTown    || '',
    billing_state:     job.billingState   || job.siteState   || '',
    billing_zip:       job.billingZip     || job.siteZip     || '',
    billing_country:   job.billingCountry || 'Australia',
    site_street:       job.siteStreet     || '',
    site_town:         job.siteTown       || '',
    site_state:        job.siteState      || '',
    site_zip:          job.siteZip        || '',
    contact_phone:     job.contactPhone   || job.customer?.phone || '',
    contact_email:     job.contactEmail   || job.customer?.email || '',
    job_ref:           job.jobRef         || '',
    abn:               '90 661 948 456',
    gst_rate:          (job.gstRate || 10) / 100,
    gross_amount:      invoice.grossAmount,
    credit:            invoice.credit,
    retention_release: invoice.retentionRelease,
    tax_amount:        invoice.taxAmount,
    total_amount:      invoice.totalAmount,
    total_paid:        +totalPaid.toFixed(2),
    balance_due:       +balanceDue.toFixed(2),
    line_items: job.lineItems.map(li => ({
      description: li.description,
      qty:         li.qty,
      unit_sell:   li.unitSell,
      is_header:   li.isHeader,
    })),
    payments: invoice.payments.map(p => ({
      paid_on:   new Date(p.paidOn).toLocaleDateString('en-AU'),
      amount:    p.amount,
      method:    p.method,
      reference: p.reference || '',
    })),
    _invoice: invoice,
  };
}

// ── Routes ────────────────────────────────────────────────────────────────────

// POST /api/billing/invoices/:id/pdf
router.post('/invoices/:id/pdf', async (req, res) => {
  try {
    const payload = await buildPayload(req.params.id);
    const pdfPath = await generatePDF('generate_invoice', payload);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Invoice-${payload.invoice_number}.pdf"`);
    fs.createReadStream(pdfPath).pipe(res).on('finish', () => fs.unlink(pdfPath, () => {}));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/billing/invoices/:id/email
router.post('/invoices/:id/email', async (req, res) => {
  try {
    const { to, subject, body } = req.body;
    const payload = await buildPayload(req.params.id);
    const pdfPath = await generatePDF('generate_invoice', payload);

    const emailTo = to
      || payload._invoice.job.customer?.email
      || payload._invoice.job.contactEmail;
    if (!emailTo) {
      fs.unlink(pdfPath, () => {});
      return res.status(400).json({ error: 'No recipient email address found on this job' });
    }

    await transporter.sendMail({
      from:    process.env.SMTP_FROM || process.env.SMTP_USER,
      to:      emailTo,
      subject: subject || `Tax Invoice ${payload.invoice_number} — Flooring Junction`,
      text:    body    || `Please find attached your tax invoice ${payload.invoice_number}.\n\nThank you for your business with Flooring Junction.`,
      attachments: [{ filename: `Invoice-${payload.invoice_number}.pdf`, path: pdfPath }],
    });

    fs.unlink(pdfPath, () => {});

    await prisma.invoice.update({
      where: { id: parseInt(req.params.id) },
      data:  { sent: true, sentAt: new Date() },
    });
    await prisma.timeline.create({
      data: {
        jobId:   payload._invoice.jobId,
        message: `Invoice ${payload.invoice_number} emailed to ${emailTo}`,
      },
    });

    res.json({ ok: true, sentTo: emailTo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
