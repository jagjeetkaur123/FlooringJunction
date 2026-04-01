'use strict';

/**
 * src/routes/quoteRoute.js
 *
 * Mounted at /api/jobs
 *
 * GET   /api/jobs/:id/quote   — quote summary with live margin & GST totals
 * PATCH /api/jobs/:id/quote   — save quote settings (markup, gstRate, finalQuote)
 */

const express = require('express');
const router  = express.Router();
const prisma  = require('../utils/prisma');

// GET /api/jobs/:id/quote
// Returns the job pricing fields plus derived totals:
//   grossCost, grossSell, gstAmount, totalWithGst, marginDollar, marginPct
router.get('/:id/quote', async (req, res, next) => {
  try {
    const job = await prisma.job.findUnique({
      where: { id: parseInt(req.params.id) },
      select: {
        id: true, title: true, floorType: true,
        markup: true, gstRate: true,
        costPrice: true, sellPrice: true, finalQuote: true,
        lineItems: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const nonHeaders = job.lineItems.filter(li => !li.isHeader);

    const grossCost    = nonHeaders.reduce((s, li) => s + li.qty * li.unitCost, 0);
    const grossSell    = nonHeaders.reduce((s, li) => s + li.qty * li.unitSell, 0);
    const gstAmount    = grossSell * ((job.gstRate || 10) / 100);
    const totalWithGst = grossSell + gstAmount;
    const marginDollar = grossSell - grossCost;
    const marginPct    = grossSell > 0 ? (marginDollar / grossSell) * 100 : 0;

    res.json({
      ...job,
      grossCost:    +grossCost.toFixed(2),
      grossSell:    +grossSell.toFixed(2),
      gstAmount:    +gstAmount.toFixed(2),
      totalWithGst: +totalWithGst.toFixed(2),
      marginDollar: +marginDollar.toFixed(2),
      marginPct:    +marginPct.toFixed(2),
    });
  } catch (err) { next(err); }
});

// PATCH /api/jobs/:id/quote
// Saves quote settings: markup %, GST rate %, final quote override
router.patch('/:id/quote', async (req, res, next) => {
  try {
    const { markup, gstRate, finalQuote } = req.body;
    const jobId = parseInt(req.params.id);

    const updated = await prisma.job.update({
      where: { id: jobId },
      data: {
        ...(markup     !== undefined && { markup:     parseFloat(markup) }),
        ...(gstRate    !== undefined && { gstRate:    parseFloat(gstRate) }),
        ...(finalQuote !== undefined && { finalQuote: parseFloat(finalQuote) }),
      },
    });

    await prisma.timeline.create({
      data: { jobId, message: 'Quote settings saved' },
    });

    res.json(updated);
  } catch (err) { next(err); }
});

module.exports = router;
