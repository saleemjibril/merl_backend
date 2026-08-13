import AppError from "../utils/AppError.js";

export function notFound(req, res, next) {
  next(new AppError(`Cannot find ${req.originalUrl}`, 404));
}

export function globalErrorHandler(err, req, res, next) {
  let error = err;
  if (!(error instanceof AppError)) {
    if (error.name === "ValidationError") {
      error = new AppError(error.message, 400);
    } else if (error.code === 11000) {
      error = new AppError("Duplicate value — that record already exists", 409);
    } else if (error.name === "JsonWebTokenError") {
      error = new AppError("Invalid token. Please log in again", 401);
    } else if (error.name === "TokenExpiredError") {
      error = new AppError("Session expired. Please log in again", 401);
    } else {
      console.error(err);
      error = new AppError(error.message || "Something went wrong", error.statusCode || 500);
    }
  }

  res.status(error.statusCode || 500).json({
    status: error.status || "error",
    message: error.message,
  });
}
