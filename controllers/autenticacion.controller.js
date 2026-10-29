const mongoose = require('mongoose');

const Usuario = require('../models/usuario.model');
const { ROLES } = require('../models/usuario.model');
const Cliente = require('../models/cliente.model');
const {
  hashPassword,
  verificarPassword,
  crearSesion,
  revocarSesion,
  firmarToken,
  firmarRefreshToken,
  verificarRefreshToken,
  buscarSesionPorId,
  LONGITUD_MINIMA_PASSWORD,
  LONGITUD_MAXIMA_PASSWORD,
  longitudPasswordValida,
} = require('../services/autenticacion.service');
const { registrarAuditoria } = require('../services/auditoria.service');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LONGITUD_MAXIMA_NOMBRE = 100;
const LONGITUD_MAXIMA_EMAIL = 254;

const responder = (res, status, message, data = null) =>
  res.status(status).json({ status, message, data });

const errorInterno = (res, contexto, error) => {
  console.error(`[autenticacion] ${contexto}:`, error.message);
  return responder(res, 500, 'Error interno del servidor');
};

const registro = async (req, res) => {
  try {
    const { nombre, email, password, rol } = req.body || {};

    if (
      typeof nombre !== 'string' ||
      nombre.trim().length === 0 ||
      nombre.trim().length > LONGITUD_MAXIMA_NOMBRE
    ) {
      return responder(
        res,
        400,
        `El nombre es obligatorio y debe tener máximo ${LONGITUD_MAXIMA_NOMBRE} caracteres`
      );
    }

    if (
      typeof email !== 'string' ||
      email.trim().length > LONGITUD_MAXIMA_EMAIL ||
      !EMAIL_REGEX.test(email.trim())
    ) {
      return responder(res, 400, 'El email no es válido');
    }

    if (!longitudPasswordValida(password)) {
      return responder(
        res,
        400,
        `La contraseña debe tener entre ${LONGITUD_MINIMA_PASSWORD} y ${LONGITUD_MAXIMA_PASSWORD} caracteres`
      );
    }

    if (rol !== undefined && !ROLES.includes(rol)) {
      return responder(res, 400, `El rol debe ser uno de: ${ROLES.join(', ')}`);
    }

    const datosUsuario = {
      nombre: nombre.trim(),
      email: email.trim().toLowerCase(),
      password: await hashPassword(password),
    };

    if (rol !== undefined) {
      datosUsuario.rol = rol;
    }

    const usuario = await Usuario.create(datosUsuario);

    return responder(res, 201, 'Usuario registrado correctamente', { usuario });
  } catch (error) {
    if (error.code === 11000) {
      return responder(res, 409, 'El email ya está registrado');
    }

    if (error instanceof mongoose.Error.ValidationError) {
      return responder(res, 400, 'Datos inválidos para registrar el usuario');
    }

    return errorInterno(res, 'Error al registrar usuario', error);
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (
      typeof email !== 'string' ||
      email.trim().length === 0 ||
      typeof password !== 'string' ||
      password.length === 0
    ) {
      return responder(res, 400, 'Email y contraseña son obligatorios');
    }

    const usuario = await Usuario.findOne({
      email: email.trim().toLowerCase(),
    }).select('+password');

    if (!usuario) {
      return responder(res, 401, 'Credenciales inválidas');
    }

    const passwordValida = await verificarPassword(password, usuario.password);

    if (!passwordValida) {
      return responder(res, 401, 'Credenciales inválidas');
    }

    if (!usuario.activo) {
      return responder(res, 403, 'El usuario está inactivo');
    }

    const { sessionId, sesion } = await crearSesion(usuario, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    const token = firmarToken(usuario, sesion);
    const refreshToken = firmarRefreshToken(usuario, sesion);

    usuario.ultimoAcceso = new Date();
    await usuario.save({ validateBeforeSave: false });

    req.usuario = usuario;
    req.sesion = sesion;
    await registrarAuditoria(req, {
      accion: 'auth.login',
      entidad: 'Usuario',
      entidadId: usuario._id,
      detalle: usuario.email,
    });

    return responder(res, 200, 'Sesión iniciada correctamente', {
      token,
      refreshToken,
      sessionId,
      expira: sesion.expira,
      debeCambiarPassword: usuario.debeCambiarPassword,
      usuario: usuario.toJSON(),
    });
  } catch (error) {
    return errorInterno(res, 'Error al iniciar sesión', error);
  }
};

const loginCliente = async (req, res) => {
  try {
    const { documento, password } = req.body || {};

    if (
      typeof documento !== 'string' ||
      documento.trim().length === 0 ||
      typeof password !== 'string' ||
      password.length === 0
    ) {
      return responder(res, 400, 'Documento y contraseña son obligatorios');
    }

    const cliente = await Cliente.findOne({
      documento: documento.trim(),
    }).select('+password');

    if (!cliente || !cliente.password) {
      return responder(res, 401, 'Credenciales inválidas');
    }

    const passwordValida = await verificarPassword(password, cliente.password);

    if (!passwordValida) {
      return responder(res, 401, 'Credenciales inválidas');
    }

    if (cliente.activo === false) {
      return responder(res, 403, 'La cuenta del cliente está inactiva');
    }

    const { sessionId, sesion } = await crearSesion(cliente, {
      ip: req.ip,
      userAgent: req.get('user-agent'),
      tipoUsuario: 'Cliente',
    });

    const token = firmarToken(cliente, sesion);
    const refreshToken = firmarRefreshToken(cliente, sesion);

    req.usuario = cliente;
    req.sesion = sesion;
    await registrarAuditoria(req, {
      accion: 'auth.login',
      entidad: 'Cliente',
      entidadId: cliente._id,
      detalle: cliente.documento,
    });

    return responder(res, 200, 'Sesión iniciada correctamente', {
      token,
      refreshToken,
      sessionId,
      expira: sesion.expira,
      cliente: cliente.toJSON(),
    });
  } catch (error) {
    return errorInterno(res, 'Error al iniciar sesión del cliente', error);
  }
};

const refresh = async (req, res) => {
  try {
    const refreshToken = req.body ? req.body.refreshToken : null;

    if (typeof refreshToken !== 'string' || refreshToken.length === 0) {
      return responder(res, 400, 'El refresh token es obligatorio');
    }

    let payload;
    try {
      payload = verificarRefreshToken(refreshToken);
    } catch (error) {
      return responder(res, 401, 'Refresh token inválido o expirado');
    }

    if (!mongoose.isValidObjectId(payload.sid) || !mongoose.isValidObjectId(payload.sub)) {
      return responder(res, 401, 'Refresh token inválido o expirado');
    }

    const sesion = await buscarSesionPorId(payload.sid);

    if (!sesion || String(sesion.usuario._id) !== String(payload.sub)) {
      return responder(res, 401, 'Sesión inválida o expirada');
    }

    const usuario = sesion.usuario;
    const token = firmarToken(usuario, sesion);

    req.usuario = usuario;
    req.sesion = sesion;
    await registrarAuditoria(req, {
      accion: 'auth.refresh',
      entidad: sesion.tipoUsuario === 'Cliente' ? 'Cliente' : 'Usuario',
      entidadId: usuario._id,
      detalle: 'Token de acceso renovado',
    });

    return responder(res, 200, 'Token renovado correctamente', {
      token,
      expira: sesion.expira,
      usuario: usuario.toJSON(),
    });
  } catch (error) {
    return errorInterno(res, 'Error al renovar el token', error);
  }
};

const logout = async (req, res) => {
  try {
    await registrarAuditoria(req, {
      accion: 'auth.logout',
      entidad: req.sesion && req.sesion.tipoUsuario === 'Cliente' ? 'Cliente' : 'Usuario',
      entidadId: req.usuario ? req.usuario._id : null,
      detalle: 'Cierre de sesión',
    });
    await revocarSesion(req.sesion);
    return responder(res, 200, 'Sesión cerrada correctamente');
  } catch (error) {
    return errorInterno(res, 'Error al cerrar sesión', error);
  }
};

const me = (req, res) =>
  responder(res, 200, 'Usuario autenticado', {
    usuario: req.usuario,
    auth: req.auth,
  });

module.exports = { registro, login, loginCliente, refresh, logout, me };
