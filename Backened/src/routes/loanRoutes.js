'use strict';

/**
 * Loan Registry routes — mounted at /api/loans
 *
 * GET    /api/loans              — list (filters: shop, status, from, to)
 * POST   /api/loans              — create entry
 * PUT    /api/loans/:id          — update entry
 * PATCH  /api/loans/:id/return   — mark as returned
 * DELETE /api/loans/:id          — delete entry
 */

const express = require('express');
const router  = express.Router();
const prisma  = require('../utils/prisma');

// GET /api/loans?status=outstanding|returned|all&shop=X&from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/', async (req, res) => {
  try {
    const { status, shop, from, to } = req.query;
    const where = {};

    if (shop)  where.shop = shop;
    if (from || to) {
      where.loanedDate = {};
      if (from) where.loanedDate.gte = new Date(from);
      if (to)   where.loanedDate.lte = new Date(new Date(to).setHours(23, 59, 59, 999));
    }
    if (status === 'outstanding') where.returnedDate = null;
    if (status === 'returned')    where.returnedDate = { not: null };

    const loans = await prisma.loanEntry.findMany({
      where,
      orderBy: { loanedDate: 'desc' },
    });
    res.json(loans);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/loans
router.post('/', async (req, res) => {
  try {
    const { loanedDate, dueBack, loanedTo, description, notes, shop, createdBy } = req.body;
    if (!loanedTo) return res.status(400).json({ error: 'Loaned To is required' });
    const loan = await prisma.loanEntry.create({
      data: {
        loanedDate:  loanedDate  ? new Date(loanedDate)  : new Date(),
        dueBack:     dueBack     ? new Date(dueBack)      : null,
        loanedTo,
        description: description || '',
        notes:       notes       || null,
        shop:        shop        || null,
        createdBy:   createdBy   || null,
      },
    });
    res.status(201).json(loan);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/loans/:id
router.put('/:id', async (req, res) => {
  try {
    const { loanedDate, dueBack, loanedTo, description, notes, shop, updatedBy, returnedDate } = req.body;
    const loan = await prisma.loanEntry.update({
      where: { id: parseInt(req.params.id) },
      data: {
        ...(loanedDate    !== undefined && { loanedDate:    loanedDate    ? new Date(loanedDate)    : new Date() }),
        ...(dueBack       !== undefined && { dueBack:       dueBack       ? new Date(dueBack)       : null }),
        ...(returnedDate  !== undefined && { returnedDate:  returnedDate  ? new Date(returnedDate)  : null }),
        ...(loanedTo      !== undefined && { loanedTo }),
        ...(description   !== undefined && { description }),
        ...(notes         !== undefined && { notes }),
        ...(shop          !== undefined && { shop }),
        ...(updatedBy     !== undefined && { updatedBy }),
      },
    });
    res.json(loan);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/loans/:id/return  — mark as returned today
router.patch('/:id/return', async (req, res) => {
  try {
    const { returnedDate, notes, updatedBy } = req.body;
    const loan = await prisma.loanEntry.update({
      where: { id: parseInt(req.params.id) },
      data: {
        returnedDate: returnedDate ? new Date(returnedDate) : new Date(),
        ...(notes     !== undefined && { notes }),
        ...(updatedBy !== undefined && { updatedBy }),
      },
    });
    res.json(loan);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/loans/:id
router.delete('/:id', async (req, res) => {
  try {
    await prisma.loanEntry.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
