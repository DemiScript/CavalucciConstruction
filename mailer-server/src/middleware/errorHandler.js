// Centralized Express error handler. Leaks detailed messages only for
// client (4xx) errors; masks 5xx internals behind a generic message.
export default function errorHandler(err, req, res, next) {
  console.error(err.stack);
  const status = err.status || 500;
  const message =
    status < 500 ? err.message : 'Something went wrong. Please try again later.';
  res.status(status).json({ success: false, message });
}
