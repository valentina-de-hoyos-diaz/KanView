const mongoose = require('mongoose');

const Calendario = require('../models/calendario.model');
const Pedido = require('../models/pedido.model');
const { registrarAuditoria } = require('../services/auditoria.service');
const {
  consultarPaginado,
  responderPaginado,
} = require('../services/paginacion.service');

const { isValidObjectId } = mongoose;

const responder = (res, status, message, data = null) =>
  res.status(status).json({ status, message, data });

const responderError = (res, error, contexto) => {
  if (error && error.status) {
    return responder(res, error.status, error.message);
  }

  if (error instanceof mongoose.Error.ValidationError) {
    return responder(res, 400, 'Error de validación', { error: error.message });
  }

  console.error(`[calendario] ${contexto}:`, error.message);
  return responder(res, 500, contexto);
};

const fechaValida = (valor) => {
  if (valor === undefined || valor === null || valor === '') return null;
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
};

const error = (status, message) => Object.assign(new Error(message), { status });

const validarEvento = ({ titulo, inicio, fin, recordatorioMinutos, pedido }, { esNuevo }) => {
  if (typeof titulo !== 'string' || !titulo.trim() || titulo.trim().length > 255) {
    throw error(400, 'El título es obligatorio y debe tener máximo 255 caracteres');
  }

  const inicioFecha = fechaValida(inicio);
  const finFecha = fechaValida(fin);

  if (!inicioFecha || !finFecha) {
    throw error(400, 'La hora de inicio y la hora límite son obligatorias');
  }

  if (finFecha < inicioFecha) {
    throw error(400, 'La hora límite no puede ser anterior a la hora de inicio');
  }

  if (esNuevo && inicioFecha < new Date()) {
    throw error(400, 'No se pueden crear eventos en fechas pasadas');
  }

  const recordatorio = Number(recordatorioMinutos || 0);
  if (!Number.isInteger(recordatorio) || recordatorio < 0 || recordatorio > 10080) {
    throw error(400, 'El recordatorio debe ser un entero entre 0 y 10080 minutos');
  }

  if (pedido !== undefined && pedido !== null && pedido !== '') {
    if (!isValidObjectId(pedido)) {
      throw error(400, 'El pedido indicado no es válido');
    }
  }

  return {
    titulo: titulo.trim(),
    inicio: inicioFecha,
    fin: finFecha,
    recordatorioMinutos: recordatorio,
    pedido: pedido || null,
  };
};

const verificarPedido = async (pedidoId) => {
  if (!pedidoId) return null;
  const existe = await Pedido.exists({ _id: pedidoId });
  if (!existe) throw error(400, 'El pedido indicado no existe');
  return pedidoId;
};

const listarEventos = async (req, res) => {
  try {
    const filtro = { activo: { $ne: false } };

    if (req.query.desde || req.query.hasta) {
      filtro.inicio = {};
      if (req.query.desde) {
        const desde = fechaValida(req.query.desde);
        if (!desde) return responder(res, 400, 'La fecha "desde" no es válida');
        filtro.inicio.$gte = desde;
      }
      if (req.query.hasta) {
        const hasta = fechaValida(req.query.hasta);
        if (!hasta) return responder(res, 400, 'La fecha "hasta" no es válida');
        filtro.inicio.$lte = hasta;
      }
    }

    if (req.query.pedido && isValidObjectId(req.query.pedido)) {
      filtro.pedido = req.query.pedido;
    }

    const { items, paginacion } = await consultarPaginado(Calendario, filtro, {
      query: req.query,
      sort: { inicio: 1 },
      populate: [
        { path: 'pedido', select: 'codigoPedido descripcion fechaEntrega estadoPedido' },
        { path: 'usuario', select: 'nombre email' },
      ],
    });

    return responderPaginado(res, 'Eventos obtenidos correctamente', items, paginacion);
  } catch (caught) {
    return responderError(res, caught, 'Error al obtener los eventos del calendario');
  }
};

const eventosDePedidos = async (req, res) => {
  try {
    const filtro = { activo: true, fechaEntrega: { $ne: null } };

    if (req.query.desde || req.query.hasta) {
      filtro.fechaEntrega = {};
      if (req.query.desde) filtro.fechaEntrega.$gte = fechaValida(req.query.desde);
      if (req.query.hasta) filtro.fechaEntrega.$lte = fechaValida(req.query.hasta);
    }

    const pedidos = await Pedido.find(filtro)
      .populate('cliente', 'nombre documento')
      .populate('empleadoId', 'nombre cargo')
      .sort({ fechaEntrega: 1 })
      .select('codigoPedido descripcion fechaEntrega estadoPedido estadoAprobacion cliente empleadoId');

    return responder(res, 200, 'Entregas de pedidos obtenidas correctamente', pedidos);
  } catch (caught) {
    return responderError(res, caught, 'Error al obtener las entregas de pedidos');
  }
};

const obtenerEvento = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return responder(res, 400, 'El ID proporcionado no es válido');
    }

    const evento = await Calendario.findById(req.params.id)
      .populate('pedido', 'codigoPedido descripcion fechaEntrega')
      .populate('usuario', 'nombre email');

    if (!evento) return responder(res, 404, 'Evento no encontrado');

    return responder(res, 200, 'Evento obtenido correctamente', evento);
  } catch (caught) {
    return responderError(res, caught, 'Error al obtener el evento');
  }
};

const crearEvento = async (req, res) => {
  try {
    const body = req.body || {};
    const datos = validarEvento(body, { esNuevo: true });
    await verificarPedido(datos.pedido);

    const evento = await Calendario.create({
      ...datos,
      usuario: req.usuario._id,
      activo: true,
    });

    await registrarAuditoria(req, {
      accion: 'calendario.crear',
      entidad: 'Calendario',
      entidadId: evento._id,
      detalle: evento.titulo,
    });

    return responder(res, 201, 'Evento creado correctamente', evento);
  } catch (caught) {
    return responderError(res, caught, 'Error al crear el evento');
  }
};

const actualizarEvento = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return responder(res, 400, 'El ID proporcionado no es válido');
    }

    const evento = await Calendario.findById(req.params.id);
    if (!evento) return responder(res, 404, 'Evento no encontrado');

    const body = req.body || {};
    const datos = validarEvento(
      {
        titulo: body.titulo !== undefined ? body.titulo : evento.titulo,
        inicio: body.inicio !== undefined ? body.inicio : evento.inicio,
        fin: body.fin !== undefined ? body.fin : evento.fin,
        recordatorioMinutos:
          body.recordatorioMinutos !== undefined
            ? body.recordatorioMinutos
            : evento.recordatorioMinutos,
        pedido: body.pedido !== undefined ? body.pedido : evento.pedido,
      },
      { esNuevo: false }
    );

    await verificarPedido(datos.pedido);

    evento.titulo = datos.titulo;
    evento.inicio = datos.inicio;
    evento.fin = datos.fin;
    evento.recordatorioMinutos = datos.recordatorioMinutos;
    evento.pedido = datos.pedido;
    evento.recordatorioEnviado = false;

    if (body.activo !== undefined) evento.activo = Boolean(body.activo);

    await evento.save();

    await registrarAuditoria(req, {
      accion: 'calendario.actualizar',
      entidad: 'Calendario',
      entidadId: evento._id,
      detalle: evento.titulo,
    });

    return responder(res, 200, 'Evento actualizado correctamente', evento);
  } catch (caught) {
    return responderError(res, caught, 'Error al actualizar el evento');
  }
};

const eliminarEvento = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return responder(res, 400, 'El ID proporcionado no es válido');
    }

    const evento = await Calendario.findByIdAndUpdate(
      req.params.id,
      { activo: false },
      { new: true }
    );

    if (!evento) return responder(res, 404, 'Evento no encontrado');

    await registrarAuditoria(req, {
      accion: 'calendario.desactivar',
      entidad: 'Calendario',
      entidadId: evento._id,
      detalle: evento.titulo,
    });

    return responder(res, 200, 'Evento desactivado correctamente', evento);
  } catch (caught) {
    return responderError(res, caught, 'Error al desactivar el evento');
  }
};

const reactivarEvento = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return responder(res, 400, 'El ID proporcionado no es válido');
    }

    const evento = await Calendario.findByIdAndUpdate(
      req.params.id,
      { activo: true },
      { new: true }
    );

    if (!evento) return responder(res, 404, 'Evento no encontrado');

    await registrarAuditoria(req, {
      accion: 'calendario.reactivar',
      entidad: 'Calendario',
      entidadId: evento._id,
      detalle: evento.titulo,
    });

    return responder(res, 200, 'Evento reactivado correctamente', evento);
  } catch (caught) {
    return responderError(res, caught, 'Error al reactivar el evento');
  }
};

const recordatoriosPendientes = async (req, res) => {
  try {
    const ahora = new Date();
    const eventos = await Calendario.find({
      activo: { $ne: false },
      recordatorioMinutos: { $gt: 0 },
      recordatorioEnviado: false,
      inicio: { $lte: new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000) },
    })
      .populate('pedido', 'codigoPedido descripcion')
      .sort({ inicio: 1 });

    const pendientes = eventos.filter((evento) => {
      const aviso = new Date(evento.inicio.getTime() - evento.recordatorioMinutos * 60 * 1000);
      return aviso <= ahora;
    });

    return responder(res, 200, 'Recordatorios pendientes obtenidos correctamente', pendientes);
  } catch (caught) {
    return responderError(res, caught, 'Error al obtener los recordatorios');
  }
};

const marcarRecordatorioEnviado = async (req, res) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return responder(res, 400, 'El ID proporcionado no es válido');
    }

    const evento = await Calendario.findByIdAndUpdate(
      req.params.id,
      { recordatorioEnviado: true },
      { new: true }
    );

    if (!evento) return responder(res, 404, 'Evento no encontrado');

    return responder(res, 200, 'Recordatorio marcado como enviado', evento);
  } catch (caught) {
    return responderError(res, caught, 'Error al marcar el recordatorio');
  }
};

module.exports = {
  listarEventos,
  eventosDePedidos,
  obtenerEvento,
  crearEvento,
  actualizarEvento,
  eliminarEvento,
  reactivarEvento,
  recordatoriosPendientes,
  marcarRecordatorioEnviado,
};
