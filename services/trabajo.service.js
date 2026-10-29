const TareaPedido = require('../models/tareaPedido.model');
const Actividad = require('../models/actividad.model');
const Pedido = require('../models/pedido.model');

class ErrorDeTrabajo extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const normalizarFecha = (valor) => {
  if (valor === undefined || valor === null || valor === '') return null;
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return null;
  return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()));
};

const validarFechasTrabajo = (pedido, fechaInicio, fechaFin, rangoTarea = null) => {
  const inicio = normalizarFecha(fechaInicio);
  const fin = normalizarFecha(fechaFin);

  if (!inicio || !fin) {
    throw new ErrorDeTrabajo(400, 'Las fechas de inicio y fin son obligatorias y deben ser válidas');
  }

  if (inicio > fin) {
    throw new ErrorDeTrabajo(400, 'La fecha de fin no puede ser anterior a la fecha de inicio');
  }

  if (!pedido) {
    throw new ErrorDeTrabajo(400, 'El pedido indicado no existe');
  }

  const creacion = normalizarFecha(pedido.fechaCreacion);
  if (creacion && inicio < creacion) {
    throw new ErrorDeTrabajo(
      400,
      'La fecha de inicio no puede ser anterior a la fecha de registro del pedido'
    );
  }

  const limite = normalizarFecha(pedido.fechaEntrega);
  if (limite && fin > limite) {
    throw new ErrorDeTrabajo(
      400,
      'La fecha de fin no puede superar la fecha límite de entrega del pedido'
    );
  }

  if (rangoTarea) {
    const inicioTarea = normalizarFecha(rangoTarea.fechaInicio);
    const finTarea = normalizarFecha(rangoTarea.fechaFin);
    if (inicioTarea && inicio < inicioTarea) {
      throw new ErrorDeTrabajo(
        400,
        'La actividad no puede iniciar antes de la fecha de inicio de la tarea'
      );
    }
    if (finTarea && fin > finTarea) {
      throw new ErrorDeTrabajo(
        400,
        'La actividad no puede terminar después de la fecha de fin de la tarea'
      );
    }
  }

  return { inicio, fin };
};

const calcularProgreso = (actividades = []) => {
  const total = actividades.length;
  const completadas = actividades.filter((actividad) => actividad.estado === 'Completado').length;
  const pendientes = actividades.filter(
    (actividad) => !['Completado', 'Cancelado'].includes(actividad.estado)
  ).length;
  return {
    total,
    completadas,
    pendientes,
    porcentaje: total === 0 ? 0 : Math.round(((total - pendientes) / total) * 100),
  };
};

const tareaCompleta = async (tareaId) => {
  const actividades = await Actividad.find({ idTarea: tareaId, activo: { $ne: false } }).select(
    'estado'
  );
  return calcularProgreso(actividades);
};

const obtenerPedidoDeTarea = async (tareaId) => {
  const tarea = await TareaPedido.findById(tareaId);
  if (!tarea) {
    throw new ErrorDeTrabajo(404, 'Tarea no encontrada');
  }
  const pedido = await Pedido.findById(tarea.idPedido);
  if (!pedido) {
    throw new ErrorDeTrabajo(400, 'El pedido de la tarea no existe');
  }
  return { tarea, pedido };
};

module.exports = {
  ErrorDeTrabajo,
  normalizarFecha,
  validarFechasTrabajo,
  calcularProgreso,
  tareaCompleta,
  obtenerPedidoDeTarea,
};
