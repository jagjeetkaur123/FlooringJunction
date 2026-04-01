const userService = require('../services/userService');

const getUsers = async (req, res, next) => {
  try {
    const users = await userService.getAllUsers();
    res.json(users);
  } catch (err) {
    next(err);
  }
};

const createUser = async (req, res, next) => {
  try {
    const { name, email } = req.body;
    const newUser = await userService.createUser({ name, email });
    res.status(201).json(newUser);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getUsers,
  createUser
};