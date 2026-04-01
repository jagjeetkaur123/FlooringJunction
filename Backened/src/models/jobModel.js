const prisma = require('../utils/prisma');

module.exports = {
  findAll: () => prisma.job.findMany({
    include: {
      assignedTo: true,
      materials: true,
      photos: true,
      timeline: true
    }
  }),

  findById: (id) => prisma.job.findUnique({
    where: { id },
    include: {
      assignedTo: true,
      materials: true,
      photos: true,
      timeline: true
    }
  }),

  create: (data) => {
    const { title, description, status, startDate, endDate, costPrice, sellPrice, assignedToId } = data;
    return prisma.job.create({
      data: {
        title,
        description,
        status,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        costPrice: costPrice || 0,
        sellPrice: sellPrice || 0,
        assignedToId: assignedToId || null,
      }
    });
  },

  update: (id, data) => prisma.job.update({
    where: { id },
    data
  }),

  remove: (id) => prisma.job.delete({
    where: { id }
  })
};