'use strict';

/**
 * Media routes — mounted at /api/jobs
 *
 * GET    /api/jobs/:jobId/media          — list files
 * POST   /api/jobs/:jobId/media          — upload file(s)
 * PATCH  /api/jobs/:jobId/media/:id      — update notes/category
 * DELETE /api/jobs/:jobId/media/:id      — delete file
 * GET    /api/jobs/:jobId/media/:id/file — serve file
 */

const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
const router   = express.Router();
const prisma   = require('../utils/prisma');

// Upload storage — Backened/uploads/jobs/:jobId/
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const dir = path.join(__dirname, '..', '..', 'uploads', 'jobs', req.params.jobId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    const ext    = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'image/jpeg','image/png','image/gif','image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    cb(null, allowed.includes(file.mimetype));
  },
});

// GET /api/jobs/:jobId/media
router.get('/:jobId/media', async (req, res) => {
  try {
    const files = await prisma.mediaFile.findMany({
      where:   { jobId: parseInt(req.params.jobId) },
      orderBy: { createdAt: 'desc' },
    });
    res.json(files);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/jobs/:jobId/media  (multipart/form-data, field name "files")
router.post('/:jobId/media', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0)
      return res.status(400).json({ error: 'No files uploaded' });

    const category = req.body.category || 'general';
    const notes    = req.body.notes    || null;

    const records = await Promise.all(req.files.map(f =>
      prisma.mediaFile.create({
        data: {
          jobId:        parseInt(req.params.jobId),
          fileName:     f.filename,
          originalName: f.originalname,
          mimeType:     f.mimetype,
          size:         f.size,
          category,
          notes,
        },
      })
    ));
    res.status(201).json(records);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/jobs/:jobId/media/:id
router.patch('/:jobId/media/:id', async (req, res) => {
  try {
    const { category, notes } = req.body;
    const file = await prisma.mediaFile.update({
      where: { id: parseInt(req.params.id) },
      data: {
        ...(category !== undefined && { category }),
        ...(notes    !== undefined && { notes }),
      },
    });
    res.json(file);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/jobs/:jobId/media/:id
router.delete('/:jobId/media/:id', async (req, res) => {
  try {
    const file = await prisma.mediaFile.findUnique({ where: { id: parseInt(req.params.id) } });
    if (file) {
      const filePath = path.join(__dirname, '..', '..', 'uploads', 'jobs', String(file.jobId), file.fileName);
      fs.unlink(filePath, () => {});
      await prisma.mediaFile.delete({ where: { id: parseInt(req.params.id) } });
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/jobs/:jobId/media/:id/file  — serve the actual file
router.get('/:jobId/media/:id/file', async (req, res) => {
  try {
    const file = await prisma.mediaFile.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!file) return res.status(404).json({ error: 'Not found' });
    const filePath = path.join(__dirname, '..', '..', 'uploads', 'jobs', String(file.jobId), file.fileName);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${file.originalName}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
