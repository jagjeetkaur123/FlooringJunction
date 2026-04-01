'use strict';

/**
 * src/routes/costSellRoutes.js
 *
 * Mounted at /api/jobs
 *
 * GET  /api/jobs/floor-template/:type          — return template line items (no DB write)
 * POST /api/jobs/:id/apply-template            — apply a template to a job
 *      body: { type: 'carpet'|'hard_flooring', replace: true }
 */

const express = require('express');
const router  = express.Router();
const prisma  = require('../utils/prisma');

// ── Templates ─────────────────────────────────────────────────────────────────

const CARPET_TEMPLATE = [
  { description: 'Supply & Install — Carpet',       isHeader: true,  type: 'H', qty: 0, unitCost: 0, costTax: 10, unitSell: 0, sellTax: 10, tag: '', actOn: false },
  { description: 'Carpet (per m²)',                 isHeader: false, type: 'M', qty: 0, unitCost: 0, costTax: 10, unitSell: 0, sellTax: 10, tag: '', actOn: false },
  { description: 'Underlay (per m²)',               isHeader: false, type: 'M', qty: 0, unitCost: 0, costTax: 10, unitSell: 0, sellTax: 10, tag: '', actOn: false },
  { description: 'Labour',                          isHeader: true,  type: 'H', qty: 0, unitCost: 0, costTax: 10, unitSell: 0, sellTax: 10, tag: '', actOn: false },
  { description: 'Installation (per m²)',           isHeader: false, type: 'L', qty: 0, unitCost: 0, costTax: 10, unitSell: 0, sellTax: 10, tag: '', actOn: false },
  { description: 'Stairs (per step)',               isHeader: false, type: 'L', qty: 0, unitCost: 0, costTax: 10, unitSell: 0, sellTax: 10, tag: '', actOn: false },
  { description: 'Extras',                          isHeader: true,  type: 'H', qty: 0, unitCost: 0, costTax: 10, unitSell: 0, sellTax: 10, tag: '', actOn: false },
  { description: 'Take Up & Disposal of Existing Carpet', isHeader: false, type: 'O', qty: 1, unitCost: 0, costTax: 10, unitSell: 0, sellTax: 10, tag: '', actOn: false },
  { description: 'Furniture Handling',              isHeader: false, type: 'O', qty: 1, unitCost: 0, costTax: 10, unitSell: 0, sellTax: 10, tag: '', actOn: false },
  { description: 'Gripper Rod (per lm)',            isHeader: false, type: 'M', qty: 0, unitCost: 0, costTax: 10, unitSell: 0, sellTax: 10, tag: '', actOn: false },
  { description: 'Door Bars / Trims',               isHeader: false, type: 'M', qty: 0, unitCost: 0, costTax: 10, unitSell: 0, sellTax: 10, tag: '', actOn: false },
];

const HARD_FLOORING_TEMPLATE = [
  { description: 'Supply & Install — Hard Flooring',        isHeader: true,  type: 'H', qty: 0, unitCost: 0, costTax: 10, unitSell: 0, sellTax: 10, tag: '', actOn: false },
  { description: 'Timber / Hybrid / Vinyl Plank (per m²)',  isHeader: false, type: 'M', qty: 0, unitCost: 0, costTax: 10, unitSell: 0, sellTax: 10, tag: '', actOn: false },
  { description: 'Underlay (per m²)',                       isHeader: false, type: 'M', qty: 0, unitCost: 0, costTax: 10, unitSell: 0, sellTax: 10, tag: '', actOn: false },
  { description: 'Labour',                                  isHeader: true,  type: 'H', qty: 0, unitCost: 0, costTax: 10, unitSell: 0, sellTax: 10, tag: '', actOn: false },
  { description: 'Installation (per m²)',                   isHeader: false, type: 'L', qty: 0, unitCost: 0, costTax: 10, unitSell: 0, sellTax: 10, tag: '', actOn: false },
  { description: 'Preparation',                             isHeader: true,  type: 'H', qty: 0, unitCost: 0, costTax: 10, unitSell: 0, sellTax: 10, tag: '', actOn: false },
  { description: 'Floor Levelling (per m²)',                isHeader: false, type: 'L', qty: 0, unitCost: 0, costTax: 10, unitSell: 0, sellTax: 10, tag: '', actOn: false },
  { description: 'Adhesive / Glue (per m²)',                isHeader: false, type: 'M', qty: 0, unitCost: 0, costTax: 10, unitSell: 0, sellTax: 10, tag: '', actOn: false },
  { description: 'Extras',                                  isHeader: true,  type: 'H', qty: 0, unitCost: 0, costTax: 10, unitSell: 0, sellTax: 10, tag: '', actOn: false },
  { description: 'Skirting Board (per lm)',                 isHeader: false, type: 'M', qty: 0, unitCost: 0, costTax: 10, unitSell: 0, sellTax: 10, tag: '', actOn: false },
  { description: 'Door Bars / Trims',                       isHeader: false, type: 'M', qty: 0, unitCost: 0, costTax: 10, unitSell: 0, sellTax: 10, tag: '', actOn: false },
  { description: 'Stair Nosing (per step)',                 isHeader: false, type: 'M', qty: 0, unitCost: 0, costTax: 10, unitSell: 0, sellTax: 10, tag: '', actOn: false },
  { description: 'Take Up & Disposal of Existing Floor',    isHeader: false, type: 'O', qty: 1, unitCost: 0, costTax: 10, unitSell: 0, sellTax: 10, tag: '', actOn: false },
];

const TEMPLATES = {
  carpet:        CARPET_TEMPLATE,
  hard_flooring: HARD_FLOORING_TEMPLATE,
};

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/jobs/floor-template/:type
// Returns the template rows without writing to the DB.
// The frontend can preview or pass them to the bulk-save endpoint.
router.get('/floor-template/:type', (req, res) => {
  const tpl = TEMPLATES[req.params.type];
  if (!tpl) {
    return res.status(404).json({ error: 'Unknown template type. Use: carpet or hard_flooring' });
  }
  res.json(tpl.map((row, idx) => ({ ...row, sortOrder: idx })));
});

// POST /api/jobs/:id/apply-template
// Writes the chosen template as line items on the job.
// body: { type: 'carpet'|'hard_flooring', replace: true|false }
//   replace=true  (default) — deletes existing line items first
//   replace=false           — appends after existing items
router.post('/:id/apply-template', async (req, res, next) => {
  try {
    const { type, replace = true } = req.body;
    const tpl = TEMPLATES[type];
    if (!tpl) {
      return res.status(400).json({ error: 'Unknown template type. Use: carpet or hard_flooring' });
    }

    const jobId = parseInt(req.params.id);
    const job   = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return res.status(404).json({ error: 'Job not found' });

    if (replace) {
      await prisma.$transaction([
        prisma.lineItem.deleteMany({ where: { jobId } }),
        prisma.lineItem.createMany({
          data: tpl.map((row, idx) => ({ ...row, jobId, sortOrder: idx })),
        }),
      ]);
    } else {
      const count = await prisma.lineItem.count({ where: { jobId } });
      await prisma.lineItem.createMany({
        data: tpl.map((row, idx) => ({ ...row, jobId, sortOrder: count + idx })),
      });
    }

    // Tag the job with the floor type
    await prisma.job.update({ where: { id: jobId }, data: { floorType: type } });
    await prisma.timeline.create({
      data: {
        jobId,
        message: `${type === 'carpet' ? 'Carpet' : 'Hard Flooring'} template applied`,
      },
    });

    const lineItems = await prisma.lineItem.findMany({
      where: { jobId },
      orderBy: { sortOrder: 'asc' },
    });
    res.json({ lineItems, floorType: type });
  } catch (err) { next(err); }
});

module.exports = router;
