const mongoose = require('mongoose');

const Actividad = require('../models/actividad.model');
const TareaPedido = require('../models/tareaPedido.model');
const Pedido = require('../models/pedido.model');
const Trabajador = require('../models/trabajador.model');
const { ESTADOS_TRABAJO } = require('../models/tareaPedido.model');
const {
  ErrorDeTrabajo,
  validarFechasTrabajo,
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

  console.error(`[actividades] ${contexto}:`, error.message);
  return responder(res, 500, contexto);
};

const validarEmpleado = async (empleadoId) => {
  if (!isValidObjectId(empleadoId)) {
    throw new ErrorDeTrabajo(400, 'El trabajador de la actividad es obligatorio y debe ser válido');
  }

  const existe = await Trabajador.exists({ _id: empleadoId });
  if (!existe) {
    throw new ErrorDeTrabajo(400, 'El trabajador indicado no existe');
  }

  return empleadoId;
};

const reabrirTareaSiCorresponde = async (tarea) => {
  if (!tarea || tarea.estado !== 'Completado') return;

  tarea.estado = 'Pendiente';
  tarea.fechaConfirmacion = null;
  tarea.confirmadoPor = null;
  await tarea.save();

  if (tarea.empleadoId) {
    await Trabajador.updateOne(
      { _id: tarea.empleadoId, tareasRealizadas: { $gt: 0 } },
      { $inc: { tareasRealizadas: -1 } }
    );
  }

  const pedido = await Pedido.findById(tarea.idPedido);
  if (pedido && pedido.estadoPedido === 'Completado') {
    pedido.estadoPedido = 'En proceso';
    await pedido.save();
  }
};

const obtenerContextoTarea = async (tareaId) => {
  if (!isValidObjectId(tareaId)) {
    throw new ErrorDeTrabajo(400, 'La tarea es obligatoria y debe ser válida');
  }

  const tarea = await TareaPedido.findById(tareaId);
  if (!tarea) throw new ErrorDeTrabajo(404, 'Tarea no encontrada');

  const pedido = await Pedido.findById(tarea.idPedido);
  if (!pedido) throw new ErrorDeTrabajo(400, 'El pedido de la tarea no existe');

  return { tarea, pedido };
};

const filtroActividades = async (req) => {
  const filtro = { activo: { $ne: false } };

  if (req.query.estado && ESTADOS_TRABAJO.includes(req.query.estado)) {
    filtro.estado = req.query.estado;
  }

  if (req.query.tareaId && isValidObjectId(req.query.tareaId)) {
    filtro.idTarea = req.query.tareaId;
  }

  if (req.query.empleadoId && isValidObjectId(req.query.empleadoId)) {
    filtro.empleadoId = req.query.empleadoId;
  }

  if (req.query.area) {
    const trabajadores = await Trabajador.find({ cargo: req.query.area }).select('_id');
    filtro.empleadoId = { $in: trabajadores.map((trabajador) => trabajador._id) };
  }

  return filtro;
};

const listarActividades = async (req, res) => {
  try {
    const { items, paginacion } = await consultarPaginado(
      Actividad,
      await filtroActividades(req),
      {
        query: req.query,
        sort: { fechaInicio: 1, createdAt: -1 },
        populate: [
          {
            path: 'idTarea',
            select: 'nombre estado fechaInicio fechaFin idPedido',
            populate: { path: 'idPedido', select: 'codigoPedido descripcion' },
          },
          { path: 'empleadoId', select: 'nombre cargo documento' },
        ],
      }
    );

    return responderPaginado(res, 'Actividades obtenidas correctamente', items, paginacion);
  } catch (error) {
    return responderError(res, error, 'Error al obtener las actividades');
  }
};

const tableroActividades = async (req, res) => {
  try {
    const actividades = await Actividad.find(await filtroActividades(req))
      .populate({
        path: 'idTarea',
        select: 'nombre idPedido',
        populate: { path: 'idPedido', select: 'codigoPedido' },
      })
      .populate('empleadoId', 'nombre cargo documento')
      .sort({ fechaInicio: 1 });

    const columnas = {
      Pendiente: [],
      'En progreso': [],
      Completado: [],
      Cancelado: [],
    };

    actividades.forEach((actividad) => {
      const estado = actividad.estado === 'En proceso' ? 'En progreso' : actividad.estado;
      const columna = columnas[estado] || columnas.Pendiente;
      columna.push(actividad);
    });

    return responder(res, 200, 'Tablero de actividades obtenido correctamente', columnas);
  } catch (error) {
    return responderError(res, error, 'Error al obtener el tablero de actividades');
  }
};

const obtenerActividad = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return responder(res, 400, 'El ID proporcionado no es válido');
    }

    const actividad = await Actividad.findById(req.params.id)
      .populate({
        path: 'idTarea',
        select: 'nombre estado fechaInicio fechaFin idPedido',
        populate: { path: 'idPedido', select: 'codigoPedido descripcion' },
      })
      .populate('empleadoId', 'nombre cargo documento');

    if (!actividad) return responder(res, 404, 'Actividad no encontrada');

    return responder(res, 200, 'Actividad obtenida correctamente', actividad);
  } catch (error) {
    return responderError(res, error, 'Error al obtener la actividad');
  }
};

const crearActividad = async (req, res) => {
  try {
    const body = req.body || {};
    const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
    const descripcion = typeof body.descripcion === 'string' ? body.descripcion.trim() : '';

    if (!nombre) return responder(res, 400, 'El nombre de la actividad es obligatorio');
    if (!descripcion) return responder(res, 400, 'La descripción de la actividad es obligatoria');

    const { tarea, pedido } = await obtenerContextoTarea(body.idTarea);
    const empleadoId = await validarEmpleado(body.empleadoId);

    if (!tarea.activo) {
      return responder(res, 409, 'No se pueden agregar actividades a una tarea desactivada');
    }

    const { inicio, fin } = validarFechasTrabajo(
      pedido,
      body.fechaInicio,
      body.fechaFin,
      tarea
    );

    const actividad = await Actividad.create({
      nombre,
      descripcion,
      estado: ESTADOS_TRABAJO.includes(body.estado) ? body.estado : 'Pendiente',
      fechaInicio: inicio,
      fechaFin: fin,
      idTarea: tarea._id,
      empleadoId,
      activo: true,
    });

    if (actividad.estado !== 'Completado') {
      await reabrirTareaSiCorresponde(tarea);
    }

    await registrarEventoPedido(
      req,
      pedido._id,
      'actividad.crear',
      `Actividad "${actividad.nombre}" creada para la tarea "${tarea.nombre}"`
    );
    await registrarAuditoria(req, {
      accion: 'actividad.crear',
      entidad: 'Actividad',
      entidadId: actividad._id,
      detalle: `${actividad.nombre} · ${tarea.nombre}`,
    });

    return responder(res, 201, 'Actividad creada correctamente', actividad);
  } catch (error) {
    return responderError(res, error, 'Error al crear la actividad');
  }
};

const actualizarActividad = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return responder(res, 400, 'El ID proporcionado no es válido');
    }

    const actividad = await Actividad.findById(req.params.id);
    if (!actividad) return responder(res, 404, 'Actividad no encontrada');

    const body = req.body || {};
    const tareaId = body.idTarea || actividad.idTarea;
    const { tarea, pedido } = await obtenerContextoTarea(tareaId);

    if (body.nombre !== undefined) {
      if (typeof body.nombre !== 'string' || !body.nombre.trim()) {
        return responder(res, 400, 'El nombre de la actividad es obligatorio');
      }
      actividad.nombre = body.nombre.trim();
    }

    if (body.descripcion !== undefined) {
      if (typeof body.descripcion !== 'string' || !body.descripcion.trim()) {
        return responder(res, 400, 'La descripción de la actividad es obligatoria');
      }
      actividad.descripcion = body.descripcion.trim();
    }

    if (body.estado !== undefined) {
      if (!ESTADOS_TRABAJO.includes(body.estado)) {
        return responder(res, 400, `El estado debe ser uno de: ${ESTADOS_TRABAJO.join(', ')}`);
      }
      actividad.estado = body.estado;
    }

    if (body.idTarea !== undefined) actividad.idTarea = tarea._id;
    if (body.empleadoId !== undefined) {
      actividad.empleadoId = await validarEmpleado(body.empleadoId);
    }

    if (body.fechaInicio !== undefined || body.fechaFin !== undefined) {
      const { inicio, fin } = validarFechasTrabajo(
        pedido,
        body.fechaInicio || actividad.fechaInicio,
        body.fechaFin || actividad.fechaFin,
        tarea
      );
      actividad.fechaInicio = inicio;
      actividad.fechaFin = fin;
    }

    await actividad.save();

    if (actividad.estado !== 'Completado') {
      await reabrirTareaSiCorresponde(tarea);
    }

    await registrarEventoPedido(
      req,
      pedido._id,
      'actividad.actualizar',
      body.estado
        ? `Actividad "${actividad.nombre}" pasó a ${body.estado}`
        : `Actividad "${actividad.nombre}" actualizada`
    );
    await registrarAuditoria(req, {
      accion: 'actividad.actualizar',
      entidad: 'Actividad',
      entidadId: actividad._id,
      detalle: actividad.nombre,
    });

    return responder(res, 200, 'Actividad actualizada correctamente', actividad);
  } catch (error) {
    return responderError(res, error, 'Error al actualizar la actividad');
  }
};

const eliminarActividad = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return responder(res, 400, 'El ID proporcionado no es válido');
    }

    const actividad = await Actividad.findByIdAndUpdate(
      req.params.id,
      { activo: false },
      { new: true }
    );

    if (!actividad) return responder(res, 404, 'Actividad no encontrada');

    await registrarAuditoria(req, {
      accion: 'actividad.desactivar',
      entidad: 'Actividad',
      entidadId: actividad._id,
      detalle: actividad.nombre,
    });

    return responder(res, 200, 'Actividad desactivada correctamente', actividad);
  } catch (error) {
    return responderError(res, error, 'Error al desactivar la actividad');
  }
};

const reactivarActividad = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return responder(res, 400, 'El ID proporcionado no es válido');
    }

    const actividad = await Actividad.findByIdAndUpdate(
      req.params.id,
      { activo: true },
      { new: true }
    );

    if (!actividad) return responder(res, 404, 'Actividad no encontrada');

    await registrarAuditoria(req, {
      accion: 'actividad.reactivar',
      entidad: 'Actividad',
      entidadId: actividad._id,
      detalle: actividad.nombre,
    });

    return responder(res, 200, 'Actividad reactivada correctamente', actividad);
  } catch (error) {
    return responderError(res, error, 'Error al reactivar la actividad');
  }
};

module.exports = {
  listarActividades,
  tableroActividades,
  obtenerActividad,
  crearActividad,
  actualizarActividad,
  eliminarActividad,
  reactivarActividad,
};
