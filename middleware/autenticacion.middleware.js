const mongoose = require('mongoose');

const {
  buscarSesionPorSessionId,
  buscarSesionPorId,
  compararApiKey,
  verificarToken,
} = require('../services/autenticacion.service');

const noAutorizado = (res, mensaje) =>
  res.status(401).json({ status: 401, message: mensaje, data: null });

const extraerBearer = (req) => {
  const header = req.headers.authorization;

  if (typeof header !== 'string' || !header.startsWith('Bearer ')) {
    return null;
  }

  const token = header.slice('Bearer '.length).trim();
  return token || null;
};

const asignarAutenticacion = (req, tipo, sesion = null) => {
  req.usuario = sesion ? sesion.usuario : null;
  req.sesion = sesion;
  req.auth = { tipo };
};

const requireJwt = async (req, res, next) => {
  const token = extraerBearer(req);

  if (!token) {
    return noAutorizado(res, 'Token no proporcionado');
  }

  let payload;
  try {
    payload = verificarToken(token);
  } catch (error) {
    return noAutorizado(res, 'Token inválido o expirado');
  }

  if (!mongoose.isValidObjectId(payload.sid)) {
    return noAutorizado(res, 'Token inválido o expirado');
  }

  const sesion = await buscarSesionPorId(payload.sid);

  if (!sesion) {
    return noAutorizado(res, 'Sesión inválida o expirada');
  }

  asignarAutenticacion(req, 'jwt', sesion);
  return next();
};

const requireApiKey = (req, res, next) => {
  if (!compararApiKey(req.headers['x-api-key'])) {
    return noAutorizado(res, 'API key inválida');
  }

  asignarAutenticacion(req, 'apiKey');
  return next();
};

const requireSessionId = async (req, res, next) => {
  const sessionId = req.headers['x-session-id'];

  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    return noAutorizado(res, 'Session ID no proporcionado');
  }

  const sesion = await buscarSesionPorSessionId(sessionId);

  if (!sesion) {
    return noAutorizado(res, 'Sesión inválida o expirada');
  }

  asignarAutenticacion(req, 'sessionId', sesion);
  return next();
};

const authenticate = (req, res, next) => {
  if (extraerBearer(req)) {
    return requireJwt(req, res, next);
  }

  if (req.headers['x-api-key']) {
    return requireApiKey(req, res, next);
  }

  if (req.headers['x-session-id']) {
    return requireSessionId(req, res, next);
  }

  return noAutorizado(res, 'Se requiere autenticación');
};

const authenticateUser = (req, res, next) => {
  if (extraerBearer(req)) {
    return requireJwt(req, res, next);
  }

  if (req.headers['x-session-id']) {
    return requireSessionId(req, res, next);
  }

  return noAutorizado(res, 'Se requiere autenticación de usuario');
};

module.exports = {
  requireJwt,
  requireApiKey,
  requireSessionId,
  authenticate,
  authenticateUser,
};
