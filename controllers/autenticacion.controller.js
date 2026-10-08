const mongoose = require('mongoose');

const Usuario = require('../models/usuario.model');
const { ROLES } = require('../models/usuario.model');
const {
  hashPassword,
  verificarPassword,
  crearSesion,
  revocarSesion,
  firmarToken,
} = require('../services/autenticacion.service');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LONGITUD_MINIMA_PASSWORD = 8;
const LONGITUD_MAXIMA_PASSWORD = 72;
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

    if (
      typeof password !== 'string' ||
      password.length < LONGITUD_MINIMA_PASSWORD ||
      password.length > LONGITUD_MAXIMA_PASSWORD
    ) {
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

    return responder(res, 200, 'Sesión iniciada correctamente', {
      token,
      sessionId,
      expira: sesion.expira,
      usuario: usuario.toJSON(),
    });
  } catch (error) {
    return errorInterno(res, 'Error al iniciar sesión', error);
  }
};

const logout = async (req, res) => {
  try {
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

module.exports = { registro, login, logout, me };
