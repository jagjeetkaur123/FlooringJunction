'use strict';

/**
 * Product Catalogue routes — mounted at /api/products
 *
 * GET    /api/products                     — list all products (with colours)
 * POST   /api/products                     — create product
 * GET    /api/products/:id                 — get single product
 * PUT    /api/products/:id                 — update product
 * DELETE /api/products/:id                 — delete product
 * POST   /api/products/:id/colors          — add colour to product
 * PUT    /api/products/:id/colors/:cid     — update colour
 * DELETE /api/products/:id/colors/:cid     — delete colour
 * GET    /api/products/search?q=           — search products + colours
 */

const express = require('express');
const router  = express.Router();
const prisma  = require('../utils/prisma');

// GET /api/products?category=carpet&active=true
router.get('/', async (req, res) => {
  try {
    const where = {};
    if (req.query.category) where.category = req.query.category;
    if (req.query.active !== 'false') where.isActive = true;
    const products = await prisma.product.findMany({
      where,
      include: { colors: { where: { isActive: true }, orderBy: { name: 'asc' } } },
      orderBy: [{ supplier: 'asc' }, { name: 'asc' }],
    });
    res.json(products);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/products/search?q=greenridge
router.get('/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        OR: [
          { name:     { contains: q, mode: 'insensitive' } },
          { supplier: { contains: q, mode: 'insensitive' } },
          { category: { contains: q, mode: 'insensitive' } },
          { colors: { some: { name: { contains: q, mode: 'insensitive' }, isActive: true } } },
          { colors: { some: { code: { contains: q, mode: 'insensitive' }, isActive: true } } },
        ],
      },
      include: { colors: { where: { isActive: true }, orderBy: { name: 'asc' } } },
      orderBy: [{ supplier: 'asc' }, { name: 'asc' }],
      take: 20,
    });
    res.json(products);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/products/:id
router.get('/:id', async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { colors: { orderBy: { name: 'asc' } } },
    });
    if (!product) return res.status(404).json({ error: 'Not found' });
    res.json(product);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/products
router.post('/', async (req, res) => {
  try {
    const { supplier, name, category, unit, width, costPrice, sellPrice, taxPercent, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Product name is required' });
    const product = await prisma.product.create({
      data: {
        supplier:   supplier   || '',
        name,
        category:   category   || 'carpet',
        unit:       unit       || 'M',
        width:      width      ? parseFloat(width)      : null,
        costPrice:  costPrice  ? parseFloat(costPrice)  : 0,
        sellPrice:  sellPrice  ? parseFloat(sellPrice)  : null,
        taxPercent: taxPercent ? parseFloat(taxPercent) : 10,
        notes:      notes      || null,
      },
      include: { colors: true },
    });
    res.status(201).json(product);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/products/:id
router.put('/:id', async (req, res) => {
  try {
    const { supplier, name, category, unit, width, costPrice, sellPrice, taxPercent, notes, isActive } = req.body;
    const product = await prisma.product.update({
      where: { id: parseInt(req.params.id) },
      data: {
        ...(supplier   !== undefined && { supplier }),
        ...(name       !== undefined && { name }),
        ...(category   !== undefined && { category }),
        ...(unit       !== undefined && { unit }),
        ...(width      !== undefined && { width: width ? parseFloat(width) : null }),
        ...(costPrice  !== undefined && { costPrice:  parseFloat(costPrice)  }),
        ...(sellPrice  !== undefined && { sellPrice:  sellPrice ? parseFloat(sellPrice) : null }),
        ...(taxPercent !== undefined && { taxPercent: parseFloat(taxPercent) }),
        ...(notes      !== undefined && { notes }),
        ...(isActive   !== undefined && { isActive }),
      },
      include: { colors: { orderBy: { name: 'asc' } } },
    });
    res.json(product);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/products/:id
router.delete('/:id', async (req, res) => {
  try {
    await prisma.product.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/products/:id/colors
router.post('/:id/colors', async (req, res) => {
  try {
    const { code, name, costPrice } = req.body;
    if (!name) return res.status(400).json({ error: 'Colour name is required' });
    const color = await prisma.productColor.create({
      data: {
        productId: parseInt(req.params.id),
        code:      code      || '',
        name,
        costPrice: costPrice ? parseFloat(costPrice) : null,
      },
    });
    res.status(201).json(color);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/products/:id/colors/:cid
router.put('/:id/colors/:cid', async (req, res) => {
  try {
    const { code, name, costPrice, isActive } = req.body;
    const color = await prisma.productColor.update({
      where: { id: parseInt(req.params.cid) },
      data: {
        ...(code      !== undefined && { code }),
        ...(name      !== undefined && { name }),
        ...(costPrice !== undefined && { costPrice: costPrice ? parseFloat(costPrice) : null }),
        ...(isActive  !== undefined && { isActive }),
      },
    });
    res.json(color);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/products/:id/colors/:cid
router.delete('/:id/colors/:cid', async (req, res) => {
  try {
    await prisma.productColor.delete({ where: { id: parseInt(req.params.cid) } });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
