import rateLimit from 'express-rate-limit';

/**
 * Rate Limiter for Login Authentication Brute-Force Protection
 * Max 5 attempts per 15 minutes per IP
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: {
    error: 'Muitas tentativas de autenticação a partir deste IP. Por razões de segurança, tente novamente em 15 minutos.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Flexible Rate Limiter for Super Admin Administrative Operations
 * Max 100 requests per 1 minute per IP
 */
export const adminRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100,
  message: {
    error: 'Limite de operações administrativas atingido temporariamente. Aguarde alguns segundos.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Rate Limiter for Public APIs, Webhooks, and Card endpoints
 * Max 100 requests per 1 minute per IP
 */
export const apiRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100,
  message: {
    error: 'Limite de requisições por minuto excedido (Rate Limit). Aguarde alguns segundos para continuar.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});
