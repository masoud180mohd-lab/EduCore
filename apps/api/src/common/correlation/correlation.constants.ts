/** Incoming/outgoing client correlation header (ACF-001). */
export const CORRELATION_ID_HEADER = 'x-correlation-id';

/** Support / tracing request id; may equal correlation id (ACF-001). */
export const REQUEST_ID_HEADER = 'x-request-id';

/** Request property key for correlation id. */
export const CORRELATION_ID_REQUEST_KEY = 'correlationId';

/** Request property key for request id (feeds error envelope requestId). */
export const REQUEST_ID_REQUEST_KEY = 'requestId';
