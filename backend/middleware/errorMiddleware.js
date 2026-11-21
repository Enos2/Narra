/**
 * File: backend/middleware/errorMiddleware.js
 * Purpose: Central Express error handler.
 *
 * CHANGES
 *   - In production, 5xx responses never expose internal error messages.
 *   - Correct status codes for oversized bodies (413), malformed JSON (400),
 *     CORS rejections (403), duplicate keys (409) and upload limits (413)
 *     — these used to surface as generic 500s.
 *   - Stack traces / full error objects are only logged, never returned.
 */

'use strict';

const isProduction = process.env.NODE_ENV === 'production';

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  let statusCode = Number(err.statusCode || err.status);
  if (!(statusCode >= 400 && statusCode < 600)) {
    statusCode = res.statusCode >= 400 ? res.statusCode : 500;
  }
  let message = err.message || 'Server error';

  if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid resource ID';
  } else if (err.name === 'ValidationError' && err.errors) {
    statusCode = 400;
    message = Object.values(err.errors).map((e) => e.message).join(', ');
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  } else if (err.type === 'entity.too.large') {
    statusCode = 413;
    message = 'Request body is too large';
  } else if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Invalid JSON in request body';
  } else if (err.message === 'Not allowed by CORS') {
    statusCode = 403;
    message = 'Origin not allowed';
  } else if (err.code === 11000) {
    statusCode = 409;
    message = 'A record with that value already exists';
  } else if (err.name === 'MulterError') {
    statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'Uploaded file is too large' : 'Invalid file upload';
  }

  if (statusCode >= 500) {
    console.error(`🔥 ${req.method} ${req.originalUrl} →`, err);
    if (isProduction) message = 'Internal server error';
  }

  res.status(statusCode).json({ success: false, message });
};

module.exports = errorHandler;

// ═══ END OF FILE: backend/middleware/errorMiddleware.js ═══