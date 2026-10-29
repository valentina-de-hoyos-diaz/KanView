const mongoose = require('mongoose');

const Usuario = require('../models/usuario.model');
const Trabajador = require('../models/trabajador.model');
const Sesion = require('../models/sesion.model');
const { ROLES, ROLES_GESTION } = require('../models/usuario.model');
const {
  hashPassword,
  LONGITUD_MINIMA_PASSWORD,
  LONGITUD_MAXIMA_PASSWORD,
  longitudPasswordValida,
} = require('../services/autenticacion.service');
const { registrarAuditoria } = require('../services/auditoria.service');
const {
  consultarPaginado,
  responderPaginado,
} = require('../services/paginacion.service');

const { isValidObjectId } = mongoose;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const responder = (res, status, message, data = null) =>
  res.status(status).json({ status, message, data });

const escaparRegex = (texto) => String(texto).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const validarEmail = (email) => {
  const normalizado = typeof email === 'string' ? email.trim().toLowerCase() : '';
  return normalizado.length > 0 && normalizado.length <= 254 && EMAIL_REGEX.test(normalizado)
    ? normalizado
    : null;
};

const validarRol = (rol) => (ROLES.includes(rol) ? rol : null);

const validarTrabajadorVinculado = async (trabajadorId, usuarioId = null) => {
  if (trabajadorId === undefined || trabajadorId === null || trabajadorId === '') {
    return null;
  }

  if (!isValidObjectId(trabajadorId)) {
    throw Object.assign(new Error('El trabajador indicado no es válido'), { status: 400 });
  }

  const trabajadorExiste = await Trabajador.exists({ _id: trabajadorId });
  if (!trabajadorExiste) {
    throw Object.assign(new Error('El trabajador indicado no existe'), { status: 400 });
  }

  const filtro = { trabajadorId };
  if (usuarioId) filtro._id = { $ne: usuarioId };
  const yaVinculado = await Usuario.exists(filtro);
  if (yaVinculado) {
    throw Object.assign(
      new Error('Ese trabajador ya tiene una cuenta de acceso vinculada'),
      { status: 409 }
    );
  }

  return trabajadorId;
};

const responderError = (res, error, contexto) => {
  if (error && error.status) {
    return responder(res, error.status, error.message);
  }

  if (error && error.code === 11000) {
    return responder(res, 409, 'El correo o el trabajador ya están vinculados a otra cuenta');
  }

  if (error instanceof mongoose.Error.ValidationError) {
    return responder(res, 400, 'Datos inválidos', { error: error.message });
  }

  console.error(`[usuarios] ${contexto}:`, error.message);
  return responder(res, 500, contexto);
};

const listarUsuarios = async (req, res) => {
  try {
    const filtro = {};

    if (req.query.rol && ROLES.includes(req.query.rol)) {
      filtro.rol = req.query.rol;
    }

    if (req.query.activo !== undefined) {
      filtro.activo = String(req.query.activo) === 'true';
    }

    if (req.query.q) {
      const regex = new RegExp(escaparRegex(req.query.q), 'i');
      filtro.$or = [{ nombre: regex }, { email: regex }];
    }

    const { items, paginacion } = await consultarPaginado(Usuario, filtro, {
      query: req.query,
      sort: { nombre: 1 },
      populate: [{ path: 'trabajadorId', select: 'nombre documento cargo' }],
    });

    return responderPaginado(res, 'Usuarios obtenidos correctamente', items, paginacion);
  } catch (error) {
    return responderError(res, error, 'Error al obtener los usuarios');
  }
};

const obtenerUsuario = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return responder(res, 400, 'El ID proporcionado no es válido');
    }

    const usuario = await Usuario.findById(req.params.id).populate(
      'trabajadorId',
      'nombre documento cargo'
    );

    if (!usuario) {
      return responder(res, 404, 'Usuario no encontrado');
    }

    return responder(res, 200, 'Usuario obtenido correctamente', usuario);
  } catch (error) {
    return responderError(res, error, 'Error al obtener el usuario');
  }
};

const crearUsuario = async (req, res) => {
  try {
    const { nombre, email, password, rol, trabajadorId, debeCambiarPassword } = req.body || {};

    if (typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > 100) {
      return responder(res, 400, 'El nombre es obligatorio y debe tener máximo 100 caracteres');
    }

    const emailNormalizado = validarEmail(email);
    if (!emailNormalizado) {
      return responder(res, 400, 'El email no es válido');
    }

    const rolNormalizado = validarRol(rol || 'trabajador');
    if (!rolNormalizado) {
      return responder(res, 400, `El rol debe ser uno de: ${ROLES.join(', ')}`);
    }

    if (rolNormalizado === 'admin' && req.usuario.rol !== 'admin') {
      return responder(res, 403, 'Solo un Administrador puede crear otra cuenta de Administrador');
    }

    if (!longitudPasswordValida(password)) {
      return responder(
        res,
        400,
        `La contraseña debe tener entre ${LONGITUD_MINIMA_PASSWORD} y ${LONGITUD_MAXIMA_PASSWORD} caracteres`
      );
    }

    const trabajador = await validarTrabajadorVinculado(trabajadorId);
    const usuario = await Usuario.create({
      nombre: nombre.trim(),
      email: emailNormalizado,
      password: await hashPassword(password),
      rol: rolNormalizado,
      ...(trabajador ? { trabajadorId: trabajador } : {}),
      debeCambiarPassword: debeCambiarPassword !== false,
    });

    await registrarAuditoria(req, {
      accion: 'usuario.crear',
      entidad: 'Usuario',
      entidadId: usuario._id,
      detalle: `${usuario.email} · rol ${usuario.rol}`,
    });

    return responder(res, 201, 'Usuario creado correctamente', usuario);
  } catch (error) {
    return responderError(res, error, 'Error al crear el usuario');
  }
};

const actualizarUsuario = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return responder(res, 400, 'El ID proporcionado no es válido');
    }

    const usuario = await Usuario.findById(req.params.id);

    if (!usuario) {
      return responder(res, 404, 'Usuario no encontrado');
    }

    if (usuario.rol === 'admin' && req.usuario.rol !== 'admin') {
      return responder(res, 403, 'Solo un Administrador puede modificar una cuenta de Administrador');
    }

    const { nombre, email, rol, activo, trabajadorId, debeCambiarPassword } = req.body || {};

    if (nombre !== undefined) {
      if (typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > 100) {
        return responder(res, 400, 'El nombre debe tener entre 1 y 100 caracteres');
      }
      usuario.nombre = nombre.trim();
    }

    if (email !== undefined) {
      const emailNormalizado = validarEmail(email);
      if (!emailNormalizado) {
        return responder(res, 400, 'El email no es válido');
      }
      usuario.email = emailNormalizado;
    }

    if (rol !== undefined) {
      const rolNormalizado = validarRol(rol);
      if (!rolNormalizado) {
        return responder(res, 400, `El rol debe ser uno de: ${ROLES.join(', ')}`);
      }
      if (rolNormalizado === 'admin' && req.usuario.rol !== 'admin') {
        return responder(res, 403, 'Solo un Administrador puede asignar el rol Administrador');
      }
      usuario.rol = rolNormalizado;
    }

    if (activo !== undefined) {
      usuario.activo = Boolean(activo);
      if (!usuario.activo) {
        await Sesion.updateMany(
          { usuario: usuario._id, tipoUsuario: 'Usuario' },
          { activa: false }
        );
      }
    }

    if (trabajadorId !== undefined) {
      const vinculado = await validarTrabajadorVinculado(trabajadorId, usuario._id);
      usuario.trabajadorId = vinculado || undefined;
    }

    if (debeCambiarPassword !== undefined) {
      usuario.debeCambiarPassword = Boolean(debeCambiarPassword);
    }

    await usuario.save();

    await registrarAuditoria(req, {
      accion: 'usuario.actualizar',
      entidad: 'Usuario',
      entidadId: usuario._id,
      detalle: usuario.email,
    });

    return responder(res, 200, 'Usuario actualizado correctamente', usuario);
  } catch (error) {
    return responderError(res, error, 'Error al actualizar el usuario');
  }
};

const restablecerPassword = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return responder(res, 400, 'El ID proporcionado no es válido');
    }

    const usuario = await Usuario.findById(req.params.id);

    if (!usuario) {
      return responder(res, 404, 'Usuario no encontrado');
    }

    if (usuario.rol === 'admin' && req.usuario.rol !== 'admin') {
      return responder(res, 403, 'Solo un Administrador puede restablecer una cuenta de Administrador');
    }

    const password = req.body ? req.body.password : undefined;
    if (!longitudPasswordValida(password)) {
      return responder(
        res,
        400,
        `La contraseña debe tener entre ${LONGITUD_MINIMA_PASSWORD} y ${LONGITUD_MAXIMA_PASSWORD} caracteres`
      );
    }

    usuario.password = await hashPassword(password);
    usuario.debeCambiarPassword = true;
    await usuario.save();
    await Sesion.updateMany(
      { usuario: usuario._id, tipoUsuario: 'Usuario' },
      { activa: false }
    );

    await registrarAuditoria(req, {
      accion: 'usuario.password',
      entidad: 'Usuario',
      entidadId: usuario._id,
      detalle: 'Contraseña restablecida por administración',
    });

    return responder(res, 200, 'Contraseña restablecida correctamente');
  } catch (error) {
    return responderError(res, error, 'Error al restablecer la contraseña');
  }
};

const desactivarUsuario = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return responder(res, 400, 'El ID proporcionado no es válido');
    }

    if (String(req.usuario._id) === String(req.params.id)) {
      return responder(res, 400, 'No puedes desactivar tu propia cuenta');
    }

    const usuario = await Usuario.findById(req.params.id);

    if (!usuario) {
      return responder(res, 404, 'Usuario no encontrado');
    }

    if (usuario.rol === 'admin' && req.usuario.rol !== 'admin') {
      return responder(res, 403, 'Solo un Administrador puede desactivar una cuenta de Administrador');
    }

    usuario.activo = false;
    await usuario.save();
    await Sesion.updateMany(
      { usuario: usuario._id, tipoUsuario: 'Usuario' },
      { activa: false }
    );

    await registrarAuditoria(req, {
      accion: 'usuario.desactivar',
      entidad: 'Usuario',
      entidadId: usuario._id,
      detalle: usuario.email,
    });

    return responder(res, 200, 'Usuario desactivado correctamente', usuario);
  } catch (error) {
    return responderError(res, error, 'Error al desactivar el usuario');
  }
};

module.exports = {
  ROLES_GESTION,
  listarUsuarios,
  obtenerUsuario,
  crearUsuario,
  actualizarUsuario,
  restablecerPassword,
  desactivarUsuario,
};
