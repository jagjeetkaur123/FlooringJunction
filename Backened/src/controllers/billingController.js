'use strict';

const billingService = require('../services/billingService');

const listInvoices = async (req, res, next) => {
  try {
    res.json(await billingService.getInvoicesForJob(req.params.jobId));
  } catch (err) { next(err); }
};

const createInvoice = async (req, res, next) => {
  try {
    const invoice = await billingService.createInvoice(req.params.jobId, req.body);
    res.status(201).json(invoice);
  } catch (err) { next(err); }
};

const getInvoice = async (req, res, next) => {
  try {
    res.json(await billingService.getInvoice(req.params.id));
  } catch (err) { next(err); }
};

const updateInvoice = async (req, res, next) => {
  try {
    res.json(await billingService.updateInvoice(req.params.id, req.body));
  } catch (err) { next(err); }
};

const deleteInvoice = async (req, res, next) => {
  try {
    await billingService.deleteInvoice(req.params.id);
    res.json({ message: 'Invoice deleted' });
  } catch (err) { next(err); }
};

const createPayment = async (req, res, next) => {
  try {
    const payment = await billingService.createPayment(req.params.id, req.body);
    res.status(201).json(payment);
  } catch (err) { next(err); }
};

const deletePayment = async (req, res, next) => {
  try {
    await billingService.deletePayment(req.params.id, req.params.payId);
    res.json({ message: 'Payment removed' });
  } catch (err) { next(err); }
};

module.exports = {
  listInvoices, createInvoice, getInvoice,
  updateInvoice, deleteInvoice,
  createPayment, deletePayment,
};
