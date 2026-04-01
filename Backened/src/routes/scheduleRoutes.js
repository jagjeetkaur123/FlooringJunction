'use strict';

/**
 * Schedule routes — mounted at /api/jobs
 *
 * GET    /api/jobs/:jobId/schedule          — list entries
 * POST   /api/jobs/:jobId/schedule          — create entry
 * PATCH  /api/jobs/:jobId/schedule/:id      — update entry
 * DELETE /api/jobs/:jobId/schedule/:id      — delete entry
 */

const express = require('express');
const router  = express.Router();
const prisma  = require('../utils/prisma');

// GET /api/jobs/:jobId/schedule
router.get('/:jobId/schedule', async (req, res) => {
  try {
    const entries = await prisma.scheduleEntry.findMany({
      where: { jobId: parseInt(req.params.jobId) },
      orderBy: { date: 'asc' },
    });
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/jobs/:jobId/schedule
router.post('/:jobId/schedule', async (req, res) => {
  try {
    const { date, time, representative, details, type, status } = req.body;
    const entry = await prisma.scheduleEntry.create({
      data: {
        jobId:          parseInt(req.params.jobId),
        date:           new Date(date),
        time:           time || null,
        representative: representative || '',
        details:        details || '',
        type:           type   || 'installation',
        status:         status || 'open',
      },
    });
    res.status(201).json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/jobs/:jobId/schedule/:id
router.patch('/:jobId/schedule/:id', async (req, res) => {
  try {
    const { date, time, representative, details, type, status } = req.body;
    const data = {};
    if (date           !== undefined) data.date           = new Date(date);
    if (time           !== undefined) data.time           = time || null;
    if (representative !== undefined) data.representative = representative;
    if (details        !== undefined) data.details        = details;
    if (type           !== undefined) data.type           = type;
    if (status         !== undefined) data.status         = status;

    const entry = await prisma.scheduleEntry.update({
      where: { id: parseInt(req.params.id) },
      data,
    });
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/jobs/:jobId/schedule/:id
router.delete('/:jobId/schedule/:id', async (req, res) => {
  try {
    await prisma.scheduleEntry.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
