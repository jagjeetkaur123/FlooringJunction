const prisma = require('../utils/prisma');

// ── Jobs ─────────────────────────────────────────────────────────────────────

const getAll = async ({ status, customerId } = {}) => {
  return prisma.job.findMany({
    where: {
      ...(status && { status }),
      ...(customerId && { customerId: parseInt(customerId) }),
    },
    include: {
      customer: true,
      assignedTo: { select: { id: true, fullName: true, email: true } },
      _count: { select: { materials: true, photos: true, lineItems: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
};

const getDashboard = async () => {
  const [total, pending, inProgress, completed] = await Promise.all([
    prisma.job.count(),
    prisma.job.count({ where: { status: 'pending' } }),
    prisma.job.count({ where: { status: 'in_progress' } }),
    prisma.job.count({ where: { status: 'completed' } }),
  ]);

  // Revenue from all jobs with a sellPrice
  const revenueResult = await prisma.job.aggregate({
    _sum: { sellPrice: true },
    where: { status: 'completed' },
  });

  const recentJobs = await prisma.job.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: { customer: true },
  });

  return {
    total,
    pending,
    inProgress,
    completed,
    totalRevenue: revenueResult._sum.sellPrice || 0,
    recentJobs,
  };
};

const getOne = async (id) => {
  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      customer: true,
      assignedTo: { select: { id: true, fullName: true, email: true } },
      materials: true,
      photos: true,
      timeline: { orderBy: { createdAt: 'desc' } },
      lineItems: { orderBy: { sortOrder: 'asc' } },
    },
  });
  if (!job) {
    const err = new Error('Job not found');
    err.status = 404;
    throw err;
  }
  return job;
};

const create = async (data) => {
  const {
    title, description, status = 'pending',
    startDate, endDate, costPrice = 0, sellPrice = 0,
    customerId, assignedToId,
    leadNumber, jobCategory, shop, jobSource, terms,
    customerName, siteStreet, siteTown, siteState, siteCountry, siteZip,
    billingStreet, billingTown, billingState, billingZip, billingCountry,
    projectName, contactName, contactPhone, contactEmail, contactFax, jobRef,
    quoteDate, initiatedDate, floorType,
  } = data;

  return prisma.job.create({
    data: {
      title: title || `${customerName || 'New'} Job`,
      description,
      status,
      startDate:     startDate     ? new Date(startDate)     : null,
      endDate:       endDate       ? new Date(endDate)       : null,
      quoteDate:     quoteDate     ? new Date(quoteDate)     : null,
      initiatedDate: initiatedDate ? new Date(initiatedDate) : null,
      costPrice:  parseFloat(costPrice)  || 0,
      sellPrice:  parseFloat(sellPrice)  || 0,
      ...(customerId   && { customerId:   parseInt(customerId) }),
      ...(assignedToId && { assignedToId: parseInt(assignedToId) }),
      // Job meta
      ...(leadNumber   !== undefined && { leadNumber }),
      ...(jobCategory  !== undefined && { jobCategory }),
      ...(shop         !== undefined && { shop }),
      ...(jobSource    !== undefined && { jobSource }),
      ...(terms        !== undefined && { terms }),
      ...(projectName  !== undefined && { projectName }),
      ...(jobRef       !== undefined && { jobRef }),
      ...(floorType    !== undefined && { floorType }),
      // Contact
      ...(contactName  !== undefined && { contactName }),
      ...(contactPhone !== undefined && { contactPhone }),
      ...(contactEmail !== undefined && { contactEmail }),
      ...(contactFax   !== undefined && { contactFax }),
      // Site address
      ...(siteStreet   !== undefined && { siteStreet }),
      ...(siteTown     !== undefined && { siteTown }),
      ...(siteState    !== undefined && { siteState }),
      ...(siteZip      !== undefined && { siteZip }),
      ...(siteCountry  !== undefined && { siteCountry }),
      // Billing address
      ...(billingStreet   !== undefined && { billingStreet }),
      ...(billingTown     !== undefined && { billingTown }),
      ...(billingState    !== undefined && { billingState }),
      ...(billingZip      !== undefined && { billingZip }),
      ...(billingCountry  !== undefined && { billingCountry }),
      timeline: { create: { message: 'Job created' } },
    },
    include: { customer: true },
  });
};

const update = async (id, data) => {
  await getOne(id); // throws 404 if not found

  const {
    title, description, status,
    startDate, endDate, costPrice, sellPrice,
    customerId, assignedToId,
    markup, gstRate, finalQuote,
    leadNumber, jobCategory, shop, jobSource, terms, projectName, jobRef,
    quoteDate, initiatedDate, floorType,
    contactName, contactPhone, contactEmail, contactFax,
    siteStreet, siteTown, siteState, siteZip, siteCountry,
    billingStreet, billingTown, billingState, billingZip, billingCountry,
  } = data;

  const updated = await prisma.job.update({
    where: { id },
    data: {
      ...(title        !== undefined && { title }),
      ...(description  !== undefined && { description }),
      ...(status       !== undefined && { status }),
      ...(startDate    !== undefined && { startDate:     startDate     ? new Date(startDate)     : null }),
      ...(endDate      !== undefined && { endDate:       endDate       ? new Date(endDate)       : null }),
      ...(quoteDate    !== undefined && { quoteDate:     quoteDate     ? new Date(quoteDate)     : null }),
      ...(initiatedDate !== undefined && { initiatedDate: initiatedDate ? new Date(initiatedDate) : null }),
      ...(costPrice    !== undefined && { costPrice:    parseFloat(costPrice) }),
      ...(sellPrice    !== undefined && { sellPrice:    parseFloat(sellPrice) }),
      ...(markup       !== undefined && { markup:       parseFloat(markup) }),
      ...(gstRate      !== undefined && { gstRate:      parseFloat(gstRate) }),
      ...(finalQuote   !== undefined && { finalQuote:   parseFloat(finalQuote) }),
      ...(customerId   !== undefined && { customerId:   parseInt(customerId) }),
      ...(assignedToId !== undefined && { assignedToId: parseInt(assignedToId) }),
      // Job meta
      ...(leadNumber  !== undefined && { leadNumber }),
      ...(jobCategory !== undefined && { jobCategory }),
      ...(shop        !== undefined && { shop }),
      ...(jobSource   !== undefined && { jobSource }),
      ...(terms       !== undefined && { terms }),
      ...(projectName !== undefined && { projectName }),
      ...(jobRef      !== undefined && { jobRef }),
      ...(floorType   !== undefined && { floorType }),
      // Contact
      ...(contactName  !== undefined && { contactName }),
      ...(contactPhone !== undefined && { contactPhone }),
      ...(contactEmail !== undefined && { contactEmail }),
      ...(contactFax   !== undefined && { contactFax }),
      // Site address
      ...(siteStreet  !== undefined && { siteStreet }),
      ...(siteTown    !== undefined && { siteTown }),
      ...(siteState   !== undefined && { siteState }),
      ...(siteZip     !== undefined && { siteZip }),
      ...(siteCountry !== undefined && { siteCountry }),
      // Billing address
      ...(billingStreet   !== undefined && { billingStreet }),
      ...(billingTown     !== undefined && { billingTown }),
      ...(billingState    !== undefined && { billingState }),
      ...(billingZip      !== undefined && { billingZip }),
      ...(billingCountry  !== undefined && { billingCountry }),
    },
    include: { customer: true, lineItems: { orderBy: { sortOrder: 'asc' } } },
  });

  // Add timeline entry
  await prisma.timeline.create({
    data: { jobId: id, message: `Job updated` },
  });

  return updated;
};

const updateStatus = async (id, status) => {
  await getOne(id);
  const job = await prisma.job.update({
    where: { id },
    data: { status },
  });
  await prisma.timeline.create({
    data: { jobId: id, message: `Status changed to ${status}` },
  });
  return job;
};

const remove = async (id) => {
  await getOne(id);
  return prisma.job.delete({ where: { id } });
};

// ── Line Items ────────────────────────────────────────────────────────────────

const getLineItems = async (jobId) => {
  await getOne(jobId);
  return prisma.lineItem.findMany({
    where: { jobId },
    orderBy: { sortOrder: 'asc' },
  });
};

const addLineItem = async (jobId, data) => {
  await getOne(jobId);
  const count = await prisma.lineItem.count({ where: { jobId } });

  return prisma.lineItem.create({
    data: {
      jobId,
      tag: data.tag || '',
      description: data.description || '',
      qty: parseFloat(data.qty) || 1,
      unitCost: parseFloat(data.unitCost) || 0,
      costTax: parseFloat(data.costTax) || 10,
      type: data.type || 'M',
      unitSell: parseFloat(data.unitSell) || 0,
      sellTax: parseFloat(data.sellTax) || 10,
      actOn: Boolean(data.actOn),
      isHeader: Boolean(data.isHeader),
      sortOrder: count,
    },
  });
};

const updateLineItem = async (jobId, liId, data) => {
  const item = await prisma.lineItem.findFirst({ where: { id: liId, jobId } });
  if (!item) {
    const err = new Error('Line item not found');
    err.status = 404;
    throw err;
  }

  return prisma.lineItem.update({
    where: { id: liId },
    data: {
      ...(data.tag !== undefined && { tag: data.tag }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.qty !== undefined && { qty: parseFloat(data.qty) }),
      ...(data.unitCost !== undefined && { unitCost: parseFloat(data.unitCost) }),
      ...(data.costTax !== undefined && { costTax: parseFloat(data.costTax) }),
      ...(data.type !== undefined && { type: data.type }),
      ...(data.unitSell !== undefined && { unitSell: parseFloat(data.unitSell) }),
      ...(data.sellTax !== undefined && { sellTax: parseFloat(data.sellTax) }),
      ...(data.actOn !== undefined && { actOn: Boolean(data.actOn) }),
      ...(data.sortOrder !== undefined && { sortOrder: parseInt(data.sortOrder) }),
    },
  });
};

const removeLineItem = async (liId) => {
  return prisma.lineItem.delete({ where: { id: liId } });
};

// Bulk save — deletes all existing line items and recreates from payload
// Also recalculates and saves costPrice + sellPrice on the job
const saveLineItems = async (jobId, body) => {
  const { items = [], markup = 0, gstRate = 10, finalQuote = 0 } = body;

  await getOne(jobId);

  // Recalculate totals
  const grossCost = items
    .filter(i => !i.isHeader)
    .reduce((s, li) => s + (parseFloat(li.qty) || 0) * (parseFloat(li.unitCost) || 0), 0);

  const netSell = items
    .filter(i => !i.isHeader && parseFloat(i.unitSell) > 0)
    .reduce((s, li) => s + (parseFloat(li.qty) || 0) * (parseFloat(li.unitSell) || 0), 0);

  // Run in a transaction — delete old, insert new, update job totals
  const [, , updatedJob] = await prisma.$transaction([
    // 1. Delete all existing line items for this job
    prisma.lineItem.deleteMany({ where: { jobId } }),

    // 2. Create all new line items
    prisma.lineItem.createMany({
      data: items.map((item, idx) => ({
        jobId,
        tag: item.tag || '',
        description: item.description || '',
        qty: parseFloat(item.qty) || 0,
        unitCost: parseFloat(item.unitCost) || 0,
        costTax: parseFloat(item.costTax) || 10,
        type: item.type || 'M',
        unitSell: parseFloat(item.unitSell) || 0,
        sellTax: parseFloat(item.sellTax) || 10,
        actOn: Boolean(item.actOn),
        isHeader: Boolean(item.isHeader),
        sortOrder: idx,
      })),
    }),

    // 3. Update job cost/sell totals
    prisma.job.update({
      where: { id: jobId },
      data: {
        costPrice: grossCost,
        sellPrice: parseFloat(finalQuote) || grossCost,
        markup: parseFloat(markup) || 0,
        gstRate: parseFloat(gstRate) || 10,
        finalQuote: parseFloat(finalQuote) || 0,
      },
      include: { lineItems: { orderBy: { sortOrder: 'asc' } } },
    }),
  ]);

  // Add timeline entry
  await prisma.timeline.create({
    data: { jobId, message: `Cost & Sell updated — Gross Cost $${grossCost.toFixed(2)}, Final Quote $${finalQuote}` },
  });

  return updatedJob;
};

module.exports = {
  getAll, getDashboard, getOne,
  create, update, updateStatus, remove,
  getLineItems, addLineItem, updateLineItem, removeLineItem, saveLineItems,
};
