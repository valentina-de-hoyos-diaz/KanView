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

module.exports = {
  entorno: process.env.NODE_ENV || 'development',
  port: numeroPositivo(process.env.PORT, 3000),
  mongodbUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  apiKey: process.env.API_KEY,
  sessionTtlHoras: numeroPositivo(process.env.SESSION_TTL_HOURS, 8),
};
