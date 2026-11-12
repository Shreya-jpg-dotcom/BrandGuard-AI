export function notFound(_req, res) {
  res.status(404).json({ message: 'The requested API endpoint was not found.' });
}
export function errorHandler(error, _req, res, _next) {
  if (error?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ message: 'Files must be 15 MB or smaller.' });
  if (error?.name === 'MulterError') return res.status(400).json({ message: 'The upload could not be processed. Check the selected file and try again.' });
  if (error?.name === 'CastError') return res.status(400).json({ message: 'The requested record identifier is invalid.' });
  if (error?.code === 11000) return res.status(409).json({ message: 'A record with this value already exists.' });
  console.error(error);
  const status = error.status || 500;
  res.status(status).json({ message: status >= 500 ? 'Something went wrong on the server. Please try again.' : error.message });
}
