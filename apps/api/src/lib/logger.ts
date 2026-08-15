import pino from 'pino';

export const logger = pino({
  level: process.env['LOG_LEVEL'] ?? (process.env['NODE_ENV'] === 'test' ? 'silent' : 'info'),
  // Never let a tenant's credentials or card data reach the log sink.
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.passwordHash',
      'req.body.cardNumber',
      'res.headers["set-cookie"]',
    ],
    remove: true,
  },
  ...(process.env['NODE_ENV'] === 'development'
    ? { transport: { target: 'pino/file', options: { destination: 1 } } }
    : {}),
});
