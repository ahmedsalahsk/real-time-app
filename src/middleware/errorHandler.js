const AppError = require("../utils/AppError");

const handleCastError = () => new AppError("Invalid resource id", 400, "Bad Request");

const handleDuplicateKey = (err) => {
  const field = Object.keys(err.keyValue || {})[0] || "field";
  return new AppError(`${field} already exists`, 409, "Duplicate Value");
};

const handleValidationError = (err) => {
  const errors = Object.values(err.errors || {}).map((item) => item.message);
  return new AppError(errors.join(", ") || "Validation failed", 400, "Validation Error");
};

const handleJwtError = () => new AppError("Invalid token", 401, "Authentication Error");

const handleJwtExpiredError = () =>
  new AppError("Token has expired", 401, "Authentication Error");

const formatError = (err) => ({
  success: false,
  message: err.message || "Internal server error",
  error: err.error || err.name || "Server Error",
  statusCode: err.statusCode || 500,
});

const errorHandler = (err, req, res, next) => {
  let error = err;

  if (err.name === "CastError") error = handleCastError(err);
  if (err.code === 11000) error = handleDuplicateKey(err);
  if (err.name === "ValidationError") error = handleValidationError(err);
  if (err.name === "JsonWebTokenError") error = handleJwtError();
  if (err.name === "TokenExpiredError") error = handleJwtExpiredError();

  const statusCode = error.statusCode || 500;
  const response = formatError(error);

  if (process.env.NODE_ENV === "production" && statusCode === 500) {
    response.message = "Internal server error";
    response.error = "Server Error";
  } else if (process.env.NODE_ENV !== "production" && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
