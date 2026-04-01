const { logger } = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  logger.error(err.message || 'Unknown error', { stack: err.stack });

  res.status(err.status || 500).json({
    error: true,
    message: err.message || 'Internal server error'
  });
};

module.exports = errorHandler;