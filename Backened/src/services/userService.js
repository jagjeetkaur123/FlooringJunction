const userModel = require('../models/userModel');

const getAllUsers = async () => {
  return await userModel.findAll();
};

const createUser = async (data) => {
  return await userModel.create(data);
};

module.exports = {
  getAllUsers,
  createUser
};