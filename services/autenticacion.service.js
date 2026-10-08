const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const config = require('../config/env');
const Sesion = require('../models/sesion.model');

const COSTO_BCRYPT = 10;
const EMISOR = 'kanview';
const AUDIENCIA = 'kanview-api';
const ALGORITMO = 'HS256';

const hashPassword = (password) => bcrypt.hash(password, COSTO_BCRYPT);

const verificarPassword = (password, hash) => bcrypt.compare(password, hash);

const generarSessionId = () => crypto.randomBytes(32).toString('hex');

const hashSessionId = (sessionId) =>
  crypto.createHash('sha256').update(sessionId).digest('hex');

const crearSesion = async (usuario, { ip, userAgent } = {}) => {
  const sessionId = generarSessionId();
  const expira = new Date(Date.now() + config.sessionTtlHoras * 60 * 60 * 1000);

  const sesion = await Sesion.create({
    sessionIdHash: hashSessionId(sessionId),
    usuario: usuario._id,
    expira,
    ip,
    userAgent,
  });

  return { sessionId, sesion };
};

const buscarSesionActiva = async (filtro) => {
  const sesion = await Sesion.findOne({
    ...filtro,
    activa: true,
    expira: { $gt: new Date() },
  }).populate('usuario');

  if (!sesion || !sesion.usuario || !sesion.usuario.activo) {
    return null;
  }

  return sesion;
};

const buscarSesionPorSessionId = (sessionId) =>
  buscarSesionActiva({ sessionIdHash: hashSessionId(sessionId) });

const buscarSesionPorId = (id) => buscarSesionActiva({ _id: id });

const revocarSesion = async (sesion) => {
  sesion.activa = false;
  await sesion.save();
};

const firmarToken = (usuario, sesion) =>
  jwt.sign(
    {
      sub: usuario._id.toString(),
      sid: sesion._id.toString(),
      rol: usuario.rol,
    },
    config.jwtSecret,
    {
      algorithm: ALGORITMO,
      expiresIn: config.jwtExpiresIn,
      issuer: EMISOR,
      audience: AUDIENCIA,
    }
  );

const verificarToken = (token) =>
  jwt.verify(token, config.jwtSecret, {
    algorithms: [ALGORITMO],
    issuer: EMISOR,
    audience: AUDIENCIA,
  });

const compararApiKey = (valor) => {
  if (typeof valor !== 'string' || valor.length === 0) {
    return false;
  }

  const esperada = crypto.createHash('sha256').update(config.apiKey).digest();
  const recibida = crypto.createHash('sha256').update(valor).digest();

  return crypto.timingSafeEqual(esperada, recibida);
};

module.exports = {
  hashPassword,
  verificarPassword,
  generarSessionId,
  hashSessionId,
  crearSesion,
  buscarSesionPorSessionId,
  buscarSesionPorId,
  revocarSesion,
  firmarToken,
  verificarToken,
  compararApiKey,
};
