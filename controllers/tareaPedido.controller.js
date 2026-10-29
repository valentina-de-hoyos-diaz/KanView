const mongoose = require('mongoose');

const TareaPedido = require('../models/tareaPedido.model');
const Actividad = require('../models/actividad.model');
const Pedido = require('../models/pedido.model');
const Trabajador = require('../models/trabajador.model');
const { ESTADOS_TRABAJO } = require('../models/tareaPedido.model');
const {
  ErrorDeTrabajo,
  validarFechasTrabajo,
  calcularProgreso,
  tareaCompleta,
} = require('../services/trabajo.service');
const { registrarEventoPedido } = require('../services/pedido.service');
const { registrarAuditoria } = require('../services/auditoria.service');
const {
  consultarPaginado,
  responderPaginado,
} = require('../services/paginacion.service');

const { isValidObjectId } = mongoose;

const responder = (res, status, message, data = null) =>
  res.status(status).json({ status, message, data });

const responderError = (res, error, contexto) => {
  if (error instanceof ErrorDeTrabajo) {
    return responder(res, error.status, error.message);
  }

  if (error instanceof mongoose.Error.ValidationError) {
    return responder(res, 400, 'Error de validación', { error: error.message });
  }

  if (error instanceof mongoose.Error.CastError) {
    return responder(res, 400, 'El ID proporcionado no es válido');
  }

  console.error(`[tareas] ${contexto}:`, error.message);
  return responder(res, 500, contexto);
};

const validarEmpleado = async (empleadoId, { obligatorio = false } = {}) => {
  if (empleadoId === undefined || empleadoId === null || empleadoId === '') {
    if (obligatorio) {
      throw new ErrorDeTrabajo(400, 'El trabajador responsable es obligatorio');
    }
    return null;
  }

  if (!isValidObjectId(empleadoId)) {
    throw new ErrorDeTrabajo(400, 'El trabajador indicado no es válido');
  }

  const existe = await Trabajador.exists({ _id: empleadoId });
  if (!existe) {
    throw new ErrorDeTrabajo(400, 'El trabajador indicado no existe');
  }

  return empleadoId;
};

const progresoDeTareas = async (tareas) => {
  if (tareas.length === 0) return new Map();

  const actividades = await Actividad.find({
    idTarea: { $in: tareas.map((tarea) => tarea._id) },
    activo: { $ne: false },
  }).select('idTarea estado');

  const agrupadas = new Map();
  actividades.forEach((actividad) => {
    const clave = String(actividad.idTarea);
    if (!agrupadas.has(clave)) agrupadas.set(clave, []);
    agrupadas.get(clave).push(actividad);
  });

  return new Map(
    tareas.map((tarea) => [String(tarea._id), calcularProgreso(agrupadas.get(String(tarea._id)) || [])])
  );
};

const listarTareas = async (req, res) => {
  try {
    const filtro = { activo: { $ne: false } };

    if (req.query.estado && ESTADOS_TRABAJO.includes(req.query.estado)) {
      filtro.estado = req.query.estado;
    }

    if (req.query.pedidoId && isValidObjectId(req.query.pedidoId)) {
      filtro.idPedido = req.query.pedidoId;
    }

    if (req.query.empleadoId && isValidObjectId(req.query.empleadoId)) {
      filtro.empleadoId = req.query.empleadoId;
    }

    const { items: tareas, paginacion } = await consultarPaginado(TareaPedido, filtro, {
      query: req.query,
      sort: { fechaInicio: 1, createdAt: -1 },
      populate: [
        { path: 'idPedido', select: 'codigoPedido descripcion fechaCreacion fechaEntrega estadoPedido' },
        { path: 'empleadoId', select: 'nombre cargo documento' },
        { path: 'confirmadoPor', select: 'nombre email' },
      ],
    });

    const progresos = await progresoDeTareas(tareas);
    const datos = tareas.map((tarea) => ({
      ...tarea.toObject(),
      progreso: progresos.get(String(tarea._id)),
    }));

    return responderPaginado(res, 'Tareas obtenidas correctamente', datos, paginacion);
  } catch (error) {
    return responderError(res, error, 'Error al obtener las tareas');
  }
};

const obtenerTarea = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return responder(res, 400, 'El ID proporcionado no es válido');
    }

    const tarea = await TareaPedido.findById(req.params.id)
      .populate('idPedido', 'codigoPedido descripcion fechaCreacion fechaEntrega estadoPedido')
      .populate('empleadoId', 'nombre cargo documento')
      .populate('confirmadoPor', 'nombre email');

    if (!tarea) {
      return responder(res, 404, 'Tarea no encontrada');
    }

    const actividades = await Actividad.find({
      idTarea: tarea._id,
      activo: { $ne: false },
    })
      .populate('empleadoId', 'nombre cargo documento')
      .sort({ fechaInicio: 1, createdAt: 1 });

    return responder(res, 200, 'Tarea obtenida correctamente', {
      ...tarea.toObject(),
      progreso: calcularProgreso(actividades),
      actividades,
    });
  } catch (error) {
    return responderError(res, error, 'Error al obtener la tarea');
  }
};

const crearTarea = async (req, res) => {
  try {
    const body = req.body || {};
    const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
    const descripcion = typeof body.descripcion === 'string' ? body.descripcion.trim() : '';

    if (!nombre) return responder(res, 400, 'El nombre de la tarea es obligatorio');
    if (!descripcion) return responder(res, 400, 'La descripción de la tarea es obligatoria');

    if (!isValidObjectId(body.idPedido)) {
      return responder(res, 400, 'El pedido es obligatorio y debe ser válido');
    }

    const pedido = await Pedido.findById(body.idPedido);
    if (!pedido) return responder(res, 404, 'Pedido no encontrado');

    if (pedido.estadoPedido === 'Completado') {
      return responder(
        res,
        409,
        'No se pueden crear tareas en un pedido completado. Reabre el pedido primero.'
      );
    }

    const { inicio, fin } = validarFechasTrabajo(pedido, body.fechaInicio, body.fechaFin);
    const empleadoId = await validarEmpleado(body.empleadoId);

    const tarea = await TareaPedido.create({
      nombre,
      descripcion,
      estado: ESTADOS_TRABAJO.includes(body.estado) ? body.estado : 'Pendiente',
      fechaInicio: inicio,
      fechaFin: fin,
      idPedido: pedido._id,
      empleadoId,
      activo: true,
    });

    await registrarEventoPedido(req, pedido._id, 'tarea.crear', `Tarea "${tarea.nombre}" creada`);
    await registrarAuditoria(req, {
      accion: 'tarea.crear',
      entidad: 'TareaPedido',
      entidadId: tarea._id,
      detalle: `${tarea.nombre} · pedido ${pedido.codigoPedido}`,
    });

    return responder(res, 201, 'Tarea creada correctamente', tarea);
  } catch (error) {
    return responderError(res, error, 'Error al crear la tarea');
  }
};

const actualizarTarea = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return responder(res, 400, 'El ID proporcionado no es válido');
    }

    const tarea = await TareaPedido.findById(req.params.id);
    if (!tarea) return responder(res, 404, 'Tarea no encontrada');

    const estadoAnterior = tarea.estado;
    const body = req.body || {};
    const pedido = await Pedido.findById(body.idPedido || tarea.idPedido);
    if (!pedido) return responder(res, 404, 'Pedido no encontrado');

    if (body.nombre !== undefined) {
      if (typeof body.nombre !== 'string' || !body.nombre.trim()) {
        return responder(res, 400, 'El nombre de la tarea es obligatorio');
      }
      tarea.nombre = body.nombre.trim();
    }

    if (body.descripcion !== undefined) {
      if (typeof body.descripcion !== 'string' || !body.descripcion.trim()) {
        return responder(res, 400, 'La descripción de la tarea es obligatoria');
      }
      tarea.descripcion = body.descripcion.trim();
    }

    if (body.estado !== undefined) {
      if (!ESTADOS_TRABAJO.includes(body.estado)) {
        return responder(res, 400, `El estado debe ser uno de: ${ESTADOS_TRABAJO.join(', ')}`);
      }
      tarea.estado = body.estado;
    }

    if (body.idPedido !== undefined) tarea.idPedido = pedido._id;
    if (body.empleadoId !== undefined) {
      tarea.empleadoId = await validarEmpleado(body.empleadoId);
    }

    if (body.fechaInicio !== undefined || body.fechaFin !== undefined) {
      const { inicio, fin } = validarFechasTrabajo(
        pedido,
        body.fechaInicio || tarea.fechaInicio,
        body.fechaFin || tarea.fechaFin
      );
      tarea.fechaInicio = inicio;
      tarea.fechaFin = fin;
    }

    if (tarea.estado === 'Completado') {
      const progreso = await tareaCompleta(tarea._id);
      if (progreso.pendientes > 0) {
        return responder(
          res,
          409,
          `No se puede completar la tarea: tiene ${progreso.pendientes} actividad(es) pendiente(s)`
        );
      }
      tarea.fechaConfirmacion = tarea.fechaConfirmacion || new Date();
      tarea.confirmadoPor = tarea.confirmadoPor || req.usuario._id;
    }

    await tarea.save();

    if (estadoAnterior !== 'Completado' && tarea.estado === 'Completado' && tarea.empleadoId) {
      await Trabajador.updateOne({ _id: tarea.empleadoId }, { $inc: { tareasRealizadas: 1 } });
    }

    await registrarEventoPedido(
      req,
      pedido._id,
      'tarea.actualizar',
      `Tarea "${tarea.nombre}" actualizada`
    );
    await registrarAuditoria(req, {
      accion: 'tarea.actualizar',
      entidad: 'TareaPedido',
      entidadId: tarea._id,
      detalle: tarea.nombre,
    });

    return responder(res, 200, 'Tarea actualizada correctamente', tarea);
  } catch (error) {
    return responderError(res, error, 'Error al actualizar la tarea');
  }
};

const confirmarTarea = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return responder(res, 400, 'El ID proporcionado no es válido');
    }

    const tarea = await TareaPedido.findById(req.params.id);
    if (!tarea) return responder(res, 404, 'Tarea no encontrada');

    if (tarea.estado === 'Completado' && tarea.fechaConfirmacion) {
      return responder(res, 200, 'La tarea ya estaba confirmada', tarea);
    }

    const esAdmin = req.usuario.rol === 'admin';
    const esResponsable =
      req.usuario.trabajadorId &&
      tarea.empleadoId &&
      String(req.usuario.trabajadorId) === String(tarea.empleadoId);

    if (!esAdmin && !esResponsable) {
      return responder(
        res,
        403,
        'Solo el responsable de la tarea o un Administrador pueden confirmarla'
      );
    }

    const progreso = await tareaCompleta(tarea._id);
    if (progreso.pendientes > 0) {
      return responder(
        res,
        409,
        `Todas las actividades deben estar completadas. Quedan ${progreso.pendientes}`
      );
    }

    tarea.estado = 'Completado';
    tarea.confirmadoPor = req.usuario._id;
    tarea.fechaConfirmacion = new Date();
    await tarea.save();

    if (tarea.empleadoId) {
      await Trabajador.updateOne({ _id: tarea.empleadoId }, { $inc: { tareasRealizadas: 1 } });
    }

    await registrarEventoPedido(
      req,
      tarea.idPedido,
      'tarea.confirmar',
      `Tarea "${tarea.nombre}" confirmada`
    );
    await registrarAuditoria(req, {
      accion: 'tarea.confirmar',
      entidad: 'TareaPedido',
      entidadId: tarea._id,
      detalle: tarea.nombre,
    });

    return responder(res, 200, 'Tarea confirmada correctamente', tarea);
  } catch (error) {
    return responderError(res, error, 'Error al confirmar la tarea');
  }
};

const eliminarTarea = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return responder(res, 400, 'El ID proporcionado no es válido');
    }

    const tarea = await TareaPedido.findByIdAndUpdate(
      req.params.id,
      { activo: false },
      { new: true }
    );

    if (!tarea) return responder(res, 404, 'Tarea no encontrada');

    await Actividad.updateMany({ idTarea: tarea._id }, { activo: false });

    await registrarEventoPedido(req, tarea.idPedido, 'tarea.desactivar', tarea.nombre);
    await registrarAuditoria(req, {
      accion: 'tarea.desactivar',
      entidad: 'TareaPedido',
      entidadId: tarea._id,
      detalle: tarea.nombre,
    });

    return responder(res, 200, 'Tarea desactivada correctamente', tarea);
  } catch (error) {
    return responderError(res, error, 'Error al desactivar la tarea');
  }
};

const reactivarTarea = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return responder(res, 400, 'El ID proporcionado no es válido');
    }

    const tarea = await TareaPedido.findByIdAndUpdate(
      req.params.id,
      { activo: true },
      { new: true }
    );

    if (!tarea) return responder(res, 404, 'Tarea no encontrada');

    await registrarAuditoria(req, {
      accion: 'tarea.reactivar',
      entidad: 'TareaPedido',
      entidadId: tarea._id,
      detalle: tarea.nombre,
    });

    return responder(res, 200, 'Tarea reactivada correctamente', tarea);
  } catch (error) {
    return responderError(res, error, 'Error al reactivar la tarea');
  }
};

module.exports = {
  listarTareas,
  obtenerTarea,
  crearTarea,
  actualizarTarea,
  confirmarTarea,
  eliminarTarea,
  reactivarTarea,
};
