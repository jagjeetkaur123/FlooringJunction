const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');

// GET    /api/jobs              - List all jobs
// POST   /api/jobs              - Create new job
// GET    /api/jobs/dashboard    - Dashboard stats
// GET    /api/jobs/:id          - Get single job (full detail)
// PUT    /api/jobs/:id          - Update job (including costPrice, sellPrice)
// PATCH  /api/jobs/:id/status   - Update status only
// DELETE /api/jobs/:id          - Delete job

// POST   /api/jobs/:id/line-items        - Add line item
// PUT    /api/jobs/:id/line-items/:liId  - Update line item
// DELETE /api/jobs/:id/line-items/:liId  - Delete line item

router.get('/dashboard', jobController.getDashboard);
router.get('/', jobController.getAll);
router.post('/', jobController.create);
router.get('/:id', jobController.getOne);
router.put('/:id', jobController.update);
router.patch('/:id/status', jobController.updateStatus);
router.delete('/:id', jobController.remove);

// Line items (Cost & Sell rows)
router.get('/:id/line-items', jobController.getLineItems);
router.post('/:id/line-items', jobController.addLineItem);
router.put('/:id/line-items/:liId', jobController.updateLineItem);
router.delete('/:id/line-items/:liId', jobController.removeLineItem);

// Bulk save all line items at once (used by Cost & Sell page Save button)
router.put('/:id/line-items', jobController.saveLineItems);

module.exports = router;
