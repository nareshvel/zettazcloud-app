const { validationResult } = require('express-validator');

/**
 * Middleware to validate request using express-validator
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        param: err.param,
        message: err.msg,
        value: err.value
      }))
    });
  }
  
  next();
};

module.exports = {
  validateRequest
};
