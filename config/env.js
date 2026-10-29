require('dotenv').config();

const LONGITUD_MINIMA_JWT_SECRET = 32;
const REQUERIDAS = ['MONGODB_URI', 'JWT_SECRET', 'API_KEY'];

const faltantes = REQUERIDAS.filter((nombre) => !process.env[nombre]);

if (faltantes.length > 0) {
  throw new Error(
    `Variables de entorno faltantes: ${faltantes.join(', ')}. Revisa .env.example`
  );
}

if (process.env.JWT_SECRET.length < LONGITUD_MINIMA_JWT_SECRET) {
  throw new Error(
    `JWT_SECRET debe tener al menos ${LONGITUD_MINIMA_JWT_SECRET} caracteres`
  );
}

const numeroPositivo = (valor, porDefecto) => {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? numero : porDefecto;
};

const valorTrustProxy = (valor) => {
  if (valor === undefined || valor === '' || valor === 'false') return false;
  if (valor === 'true') return 1;
  const numero = Number(valor);
  return Number.isInteger(numero) && numero >= 0 ? numero : valor;
};

module.exports = {
  entorno: process.env.NODE_ENV || 'development',
  port: numeroPositivo(process.env.PORT, 3000),
  mongodbUri: process.env.MONGODB_URI,
  mongodbDb: process.env.MONGODB_DB || null,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '8h',
  trustProxy: valorTrustProxy(process.env.TRUST_PROXY),
  apiKey: process.env.API_KEY,
  sessionTtlHoras: numeroPositivo(process.env.SESSION_TTL_HOURS, 8),
  cspReportOnly: process.env.CSP_REPORT_ONLY === 'true',
  rateLimit: {
    apiMax: numeroPositivo(process.env.RATE_LIMIT_API_MAX, 600),
    apiWindowMs: numeroPositivo(process.env.RATE_LIMIT_API_WINDOW_MS, 60 * 1000),
    loginMax: numeroPositivo(process.env.RATE_LIMIT_LOGIN_MAX, 10),
    loginWindowMs: numeroPositivo(process.env.RATE_LIMIT_LOGIN_WINDOW_MS, 15 * 60 * 1000),
    mensajesMax: numeroPositivo(process.env.RATE_LIMIT_MENSAJES_MAX, 30),
    mensajesWindowMs: numeroPositivo(process.env.RATE_LIMIT_MENSAJES_WINDOW_MS, 10 * 1000),
  },
  backup: {
    emailTo: process.env.BACKUP_EMAIL_TO || null,
    timezone: process.env.BACKUP_TIMEZONE || null,
    smtp: {
      host: process.env.SMTP_HOST || null,
      port: numeroPositivo(process.env.SMTP_PORT, 587),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER || null,
      pass: process.env.SMTP_PASS || null,
    },
  },
};
