'use strict';

/**
 * src/services/billingService.js
 *
 * Business logic for invoices and payments.
 */

const prisma = require('../utils/prisma');

// ── Helpers ───────────────────────────────────────────────────────────────────

async function nextInvoiceNumber() {
  const count = await prisma.invoice.count();
  return `INV-${String(count + 1).padStart(5, '0')}`;
}

function calcStatus(totalAmount, payments) {
  const paid = payments.reduce((s, p) => s + p.amount, 0);
  if (paid <= 0)                    return 'unpaid';
  if (paid < totalAmount - 0.005)   return 'partial';
  return 'paid';
}

// ── Invoice CRUD ──────────────────────────────────────────────────────────────

async function getInvoicesForJob(jobId) {
  return prisma.invoice.findMany({
    where: { jobId: parseInt(jobId) },
    include: { payments: { orderBy: { paidOn: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  });
}

async function createInvoice(jobId, data) {
  const job = await prisma.job.findUnique({
    where: { id: parseInt(jobId) },
    select: { id: true, gstRate: true, finalQuote: true, sellPrice: true },
  });
  if (!job) {
    const err = new Error('Job not found');
    err.status = 404;
    throw err;
  }

  const gstRate          = (job.gstRate || 10) / 100;
  const grossAmount      = data.grossAmount !== undefined
    ? parseFloat(data.grossAmount)
    : (job.finalQuote || job.sellPrice || 0);
  const credit           = parseFloat(data.credit || 0);
  const retentionRelease = parseFloat(data.retentionRelease || 0);
  const taxable          = Math.max(0, grossAmount - credit + retentionRelease);
  const taxAmount        = +(taxable * gstRate).toFixed(2);
  const totalAmount      = +(taxable + taxAmount).toFixed(2);

  // Default due date = 14 days from today
  const dueDate = data.dueDate
    ? new Date(data.dueDate)
    : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  return prisma.invoice.create({
    data: {
      jobId:          parseInt(jobId),
      invoiceNumber:  data.invoiceNumber || (await nextInvoiceNumber()),
      invoiceDate:    data.invoiceDate ? new Date(data.invoiceDate) : new Date(),
      dueDate,
      grossAmount,
      credit,
      retentionRelease,
      taxAmount,
      totalAmount,
      status: 'unpaid',
      notes:  data.notes || null,
    },
    include: { payments: true },
  });
}

async function getInvoice(id) {
  const inv = await prisma.invoice.findUnique({
    where: { id: parseInt(id) },
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
  if (!inv) {
    const err = new Error('Invoice not found');
    err.status = 404;
    throw err;
  }
  return inv;
}

async function updateInvoice(id, data) {
  const inv = await getInvoice(id);

  const gstRate          = (inv.job.gstRate || 10) / 100;
  const grossAmount      = data.grossAmount      !== undefined ? parseFloat(data.grossAmount)      : inv.grossAmount;
  const credit           = data.credit           !== undefined ? parseFloat(data.credit)           : inv.credit;
  const retentionRelease = data.retentionRelease !== undefined ? parseFloat(data.retentionRelease) : inv.retentionRelease;
  const taxable          = Math.max(0, grossAmount - credit + retentionRelease);
  const taxAmount        = +(taxable * gstRate).toFixed(2);
  const totalAmount      = +(taxable + taxAmount).toFixed(2);

  return prisma.invoice.update({
    where: { id: parseInt(id) },
    data: {
      ...(data.invoiceDate && { invoiceDate: new Date(data.invoiceDate) }),
      ...(data.dueDate     && { dueDate:     new Date(data.dueDate) }),
      grossAmount,
      credit,
      retentionRelease,
      taxAmount,
      totalAmount,
      status: calcStatus(totalAmount, inv.payments),
      ...(data.notes !== undefined && { notes: data.notes }),
    },
    include: { payments: true },
  });
}

async function deleteInvoice(id) {
  await getInvoice(id); // 404 guard
  return prisma.invoice.delete({ where: { id: parseInt(id) } });
}

// ── Payments ──────────────────────────────────────────────────────────────────

async function createPayment(invoiceId, data) {
  const inv = await getInvoice(invoiceId);

  const amount = parseFloat(data.amount);
  if (!amount || amount <= 0) {
    const err = new Error('Payment amount must be greater than 0');
    err.status = 400;
    throw err;
  }

  const payment = await prisma.payment.create({
    data: {
      invoiceId: parseInt(invoiceId),
      amount,
      method:    data.method    || 'bank_transfer',
      reference: data.reference || null,
      paidOn:    data.paidOn ? new Date(data.paidOn) : new Date(),
      notes:     data.notes  || null,
    },
  });

  // Recalculate invoice status with this new payment included
  const allPayments = [...inv.payments, payment];
  await prisma.invoice.update({
    where: { id: parseInt(invoiceId) },
    data:  { status: calcStatus(inv.totalAmount, allPayments) },
  });

  // Log on the job timeline
  await prisma.timeline.create({
    data: {
      jobId:   inv.jobId,
      message: `Payment of $${amount.toFixed(2)} received via ${data.method || 'bank transfer'} against ${inv.invoiceNumber}`,
    },
  });

  return payment;
}

async function deletePayment(invoiceId, paymentId) {
  const inv = await getInvoice(invoiceId);
  await prisma.payment.delete({ where: { id: parseInt(paymentId) } });

  // Recalculate status without the deleted payment
  const remaining = inv.payments.filter(p => p.id !== parseInt(paymentId));
  await prisma.invoice.update({
    where: { id: parseInt(invoiceId) },
    data:  { status: calcStatus(inv.totalAmount, remaining) },
  });
}

module.exports = {
  getInvoicesForJob,
  createInvoice,
  getInvoice,
  updateInvoice,
  deleteInvoice,
  createPayment,
  deletePayment,
};
