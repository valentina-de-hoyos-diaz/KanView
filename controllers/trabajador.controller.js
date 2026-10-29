const mongoose = require('mongoose');
const Trabajador = require('../models/trabajador.model');
const { registrarAuditoria } = require('../services/auditoria.service');
const {
  consultarPaginado,
  responderPaginado,
} = require('../services/paginacion.service');

const { Types } = mongoose;
const escaparRegex = (texto) => String(texto).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const responder = (res, status, message, data = null) =>
  res.status(status).json({ status, message, data });

const responderError = (res, error, contexto) => {
  if (error instanceof mongoose.Error.ValidationError) {
    return responder(res, 400, 'Error de validación', { error: error.message });
  }

  if (error instanceof mongoose.Error.CastError) {
    return responder(res, 400, 'Dato inválido');
  }

  console.error(`[trabajadores] ${contexto}:`, error.message);
  return responder(res, 500, contexto);
};

const campos = (body = {}) => ({
  nombre: body.nombre,
  documento: body.documento,
  celular: body.celular,
  direccion: body.direccion,
  edad: body.edad,
  fechaNacimiento: body.fechaNacimiento,
  cargo: body.cargo,
  RH: body.RH,
  salario: body.salario,
  tareasRealizadas: body.tareasRealizadas,
  correo: body.correo,
  activo: body.activo,
});

const prepararDatos = (body, { parcial = false } = {}) => {
  const datos = {};

  Object.entries(campos(body)).forEach(([campo, valor]) => {
    if (valor !== undefined) datos[campo] = valor;
  });

  if (datos.salario !== undefined) {
    const numero = Number(datos.salario);
    if (!Number.isFinite(numero) || numero < 0) {
      throw Object.assign(new Error('El salario debe ser un número mayor o igual a cero'), {
        status: 400,
      });
    }
    datos.salario = Types.Decimal128.fromString(numero.toFixed(2));
  }

  if (datos.fechaNacimiento !== undefined) {
    const fecha = new Date(datos.fechaNacimiento);
    if (Number.isNaN(fecha.getTime())) {
      throw Object.assign(new Error('La fecha de nacimiento no es válida'), { status: 400 });
    }
    datos.fechaNacimiento = fecha;
  }

  if (datos.edad !== undefined) {
    const edad = Number(datos.edad);
    if (!Number.isInteger(edad) || edad < 0) {
      throw Object.assign(new Error('La edad debe ser un entero mayor o igual a cero'), {
        status: 400,
      });
    }
    datos.edad = edad;
  }

  if (datos.tareasRealizadas !== undefined) {
    const tareas = Number(datos.tareasRealizadas);
    if (!Number.isInteger(tareas) || tareas < 0) {
      throw Object.assign(new Error('Las tareas realizadas deben ser un entero no negativo'), {
        status: 400,
      });
    }
    datos.tareasRealizadas = tareas;
  }

  if (datos.activo !== undefined) {
    datos.activo = Boolean(datos.activo);
  }

  if (!parcial) {
    const obligatorios = ['nombre', 'documento', 'celular', 'direccion', 'fechaNacimiento', 'cargo', 'RH', 'salario'];
    const faltantes = obligatorios.filter(
      (campo) => datos[campo] === undefined || datos[campo] === null || datos[campo] === ''
    );
    if (faltantes.length > 0) {
      throw Object.assign(new Error(`Faltan campos requeridos: ${faltantes.join(', ')}`), {
        status: 400,
      });
    }
    if (datos.tareasRealizadas === undefined) datos.tareasRealizadas = 0;
  }

  return datos;
};

exports.getTrabajadores = async (req, res) => {
  try {
    const filtro = String(req.query.incluirInactivos) === 'true' ? {} : { activo: { $ne: false } };

    if (req.query.q) {
      const regex = new RegExp(escaparRegex(req.query.q), 'i');
      filtro.$or = [{ nombre: regex }, { documento: regex }, { cargo: regex }, { correo: regex }];
    }

    const { items, paginacion } = await consultarPaginado(Trabajador, filtro, {
      query: req.query,
      sort: { nombre: 1 },
    });

    return responderPaginado(res, 'Trabajadores obtenidos correctamente', items, paginacion);
  } catch (error) {
    return responderError(res, error, 'Error al obtener los trabajadores');
  }
};

exports.getTrabajadorById = async (req, res) => {
  try {
    const filtro = mongoose.isValidObjectId(req.params.id)
      ? { _id: req.params.id }
      : { documento: req.params.id };
    const trabajador = await Trabajador.findOne(filtro);

    if (!trabajador) {
      return responder(res, 404, 'Trabajador no encontrado');
    }

    return responder(res, 200, 'Trabajador obtenido correctamente', trabajador);
  } catch (error) {
    return responderError(res, error, 'Error al obtener el trabajador');
  }
};

exports.createTrabajador = async (req, res) => {
  try {
    const datos = prepararDatos(req.body);
    const trabajador = await Trabajador.create({ ...datos, activo: datos.activo !== false });

    await registrarAuditoria(req, {
      accion: 'trabajador.crear',
      entidad: 'Trabajador',
      entidadId: trabajador._id,
      detalle: `${trabajador.nombre} · ${trabajador.documento}`,
    });

    return responder(res, 201, 'Trabajador creado correctamente', trabajador);
  } catch (error) {
    if (error.status) return responder(res, error.status, error.message);
    return responderError(res, error, 'Error al crear el trabajador');
  }
};

exports.updateTrabajador = async (req, res) => {
  try {
    const datos = prepararDatos(req.body, { parcial: true });

    if (Object.keys(datos).length === 0) {
      return responder(res, 400, 'No se enviaron campos para actualizar');
    }

    const filtro = mongoose.isValidObjectId(req.params.id)
      ? { _id: req.params.id }
      : { documento: req.params.id };

    const trabajador = await Trabajador.findOneAndUpdate(filtro, datos, {
      new: true,
      runValidators: true,
    });

    if (!trabajador) {
      return responder(res, 404, 'Trabajador no encontrado');
    }

    await registrarAuditoria(req, {
      accion: 'trabajador.actualizar',
      entidad: 'Trabajador',
      entidadId: trabajador._id,
      detalle: trabajador.nombre,
    });

    return responder(res, 200, 'Trabajador actualizado correctamente', trabajador);
  } catch (error) {
    if (error.status) return responder(res, error.status, error.message);
    return responderError(res, error, 'Error al actualizar el trabajador');
  }
};

exports.reactivarTrabajador = async (req, res) => {
  try {
    const filtro = mongoose.isValidObjectId(req.params.id)
      ? { _id: req.params.id }
      : { documento: req.params.id };

    const trabajador = await Trabajador.findOneAndUpdate(
      filtro,
      { activo: true },
      { returnDocument: 'after' }
    );

    if (!trabajador) {
      return responder(res, 404, 'Trabajador no encontrado');
    }

    await registrarAuditoria(req, {
      accion: 'trabajador.reactivar',
      entidad: 'Trabajador',
      entidadId: trabajador._id,
      detalle: trabajador.nombre,
    });

    return responder(res, 200, 'Trabajador reactivado correctamente', trabajador);
  } catch (error) {
    return responderError(res, error, 'Error al reactivar el trabajador');
  }
};

exports.deleteTrabajador = async (req, res) => {
  try {
    const filtro = mongoose.isValidObjectId(req.params.id)
      ? { _id: req.params.id }
      : { documento: req.params.id };

    const trabajador = await Trabajador.findOneAndUpdate(
      filtro,
      { activo: false },
      { new: true }
    );

    if (!trabajador) {
      return responder(res, 404, 'Trabajador no encontrado');
    }

    await registrarAuditoria(req, {
      accion: 'trabajador.desactivar',
      entidad: 'Trabajador',
      entidadId: trabajador._id,
      detalle: trabajador.nombre,
    });

    return responder(res, 200, 'Trabajador desactivado correctamente', trabajador);
  } catch (error) {
    return responderError(res, error, 'Error al desactivar el trabajador');
  }
};
