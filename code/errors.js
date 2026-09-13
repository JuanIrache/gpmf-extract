const messages = {
  INVALID_MP4: 'File not compatible',
  TRACK_NOT_FOUND: 'Track not found',
  EMPTY_TELEMETRY: 'Telemetry track is empty',
  INCOMPLETE_TELEMETRY: 'Telemetry samples are incomplete',
  CANCELLED: 'Canceled by user',
  READ_ERROR: 'Unable to read file',
  PARSE_ERROR: 'Unable to parse telemetry',
};

class GPMFExtractError extends Error {
  constructor(code, cause) {
    super(messages[code] || 'Extraction failed');
    this.name = 'GPMFExtractError';
    this.code = code;
    if (cause !== undefined) this.cause = cause;
  }
}

function asError(cause, code) {
  return cause instanceof GPMFExtractError ? cause : new GPMFExtractError(code, cause);
}

module.exports = { GPMFExtractError, asError };
