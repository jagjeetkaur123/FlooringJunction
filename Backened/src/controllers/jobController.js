const jobService = require('../services/jobService');

// ── Jobs ─────────────────────────────────────────────────────────────────────

const getAll = async (req, res, next) => {
  try {
    const { status, customerId } = req.query;
    const jobs = await jobService.getAll({ status, customerId });
    res.json(jobs);
  } catch (err) { next(err); }
};

const getDashboard = async (req, res, next) => {
  try {
    const stats = await jobService.getDashboard();
    res.json(stats);
  } catch (err) { next(err); }
};

const getOne = async (req, res, next) => {
  try {
    const job = await jobService.getOne(parseInt(req.params.id));
    res.json(job);
  } catch (err) { next(err); }
};

const create = async (req, res, next) => {
  try {
    const job = await jobService.create(req.body);
    res.status(201).json(job);
  } catch (err) { next(err); }
};

const update = async (req, res, next) => {
  try {
    const job = await jobService.update(parseInt(req.params.id), req.body);
    res.json(job);
  } catch (err) { next(err); }
};

const updateStatus = async (req, res, next) => {
  try {
    const job = await jobService.updateStatus(parseInt(req.params.id), req.body.status);
    res.json(job);
  } catch (err) { next(err); }
};

const remove = async (req, res, next) => {
  try {
    await jobService.remove(parseInt(req.params.id));
    res.json({ message: 'Job deleted' });
  } catch (err) { next(err); }
};

// ── Line Items (Cost & Sell rows) ─────────────────────────────────────────────

const getLineItems = async (req, res, next) => {
  try {
    const items = await jobService.getLineItems(parseInt(req.params.id));
    res.json(items);
  } catch (err) { next(err); }
};

const addLineItem = async (req, res, next) => {
  try {
    const item = await jobService.addLineItem(parseInt(req.params.id), req.body);
    res.status(201).json(item);
  } catch (err) { next(err); }
};

const updateLineItem = async (req, res, next) => {
  try {
    const item = await jobService.updateLineItem(
      parseInt(req.params.id),
      parseInt(req.params.liId),
      req.body
    );
    res.json(item);
  } catch (err) { next(err); }
};

const removeLineItem = async (req, res, next) => {
  try {
    await jobService.removeLineItem(parseInt(req.params.liId));
    res.json({ message: 'Line item deleted' });
  } catch (err) { next(err); }
};

// Bulk save — replaces all line items and updates costPrice/sellPrice on the job
const saveLineItems = async (req, res, next) => {
  try {
    const result = await jobService.saveLineItems(parseInt(req.params.id), req.body);
    res.json(result);
  } catch (err) { next(err); }
};

module.exports = {
  getAll, getDashboard, getOne,
  create, update, updateStatus, remove,
  getLineItems, addLineItem, updateLineItem, removeLineItem, saveLineItems,
};
