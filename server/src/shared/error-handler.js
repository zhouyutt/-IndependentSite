import { AppError } from './errors.js';

export function notFound(req, res) {
  res.status(404).json({
    title: 'NOT_FOUND',
    status: 404,
    detail: `No route for ${req.method} ${req.originalUrl}`,
    request_id: req.id
  });
}

export function errorHandler(err, req, res, _next) {
  if (err instanceof AppError && err.isOperational) {
    return res.status(err.statusCode).json({
      title: err.code,
      status: err.statusCode,
      detail: err.message,
      errors: err.details,
      request_id: req.id
    });
  }

  console.error(JSON.stringify({
    level: 'error',
    msg: 'Unexpected error',
    request_id: req.id,
    error: err.message,
    stack: err.stack
  }));

  return res.status(500).json({
    title: 'INTERNAL_ERROR',
    status: 500,
    detail: 'Unexpected server error',
    request_id: req.id
  });
}
