const { validationResult } = require('express-validator');

/**
 * Middleware to validate request using express-validator
 */
exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const extractedErrors = errors.array().map(err => ({
      field: err.path,
      message: err.msg,
    }));

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: extractedErrors,
    });
  }
  
  next();
};

/**
 * Custom validation middleware for specific scenarios
 */
exports.validateObjectId = (paramName = 'id') => {
  return (req, res, next) => {
    const id = req.params[paramName];
    
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: `Invalid ${paramName} format`,
      });
    }
    
    next();
  };
};

/**
 * Validate date format
 */
exports.validateDate = (fieldName) => {
  return (req, res, next) => {
    const date = req.body[fieldName];
    
    if (date && isNaN(Date.parse(date))) {
      return res.status(400).json({
        success: false,
        message: `Invalid date format for ${fieldName}`,
      });
    }
    
    next();
  };
};