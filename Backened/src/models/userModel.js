const prisma = require('../utils/prisma');

const findAll = async () => {
  return prisma.user.findMany();
};

const create = async ({ name, email }) => {
  return prisma.user.create({
    data: { name, email }
  });
};

module.exports = {
  findAll,
  create
};