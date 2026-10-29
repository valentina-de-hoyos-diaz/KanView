const mongoose = require('mongoose');

const Finanza = require('../models/finanza.model');
const Pedido = require('../models/pedido.model');
const { FUENTES_INGRESO } = require('../models/finanza.model');
const { registrarAuditoria } = require('../services/auditoria.service');
const {
  consultarPaginado,
  responderPaginado,
} = require('../services/paginacion.service');

const responder = (res, status, message, data = null) =>
  res.status(status).json({ status, message, data });

const responderError = (res, error, contexto) => {
  if (error && error.status) return responder(res, error.status, error.message);
  if (error instanceof mongoose.Error.ValidationError) {
    return responder(res, 400, 'Error de validación', { error: error.message });
  }
  console.error(`[finanzas] ${contexto}:`, error.message);
  return responder(res, 500, contexto);
};

const error = (status, message) => Object.assign(new Error(message), { status });

const decimal = (valor, campo) => {
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < 0) {
    throw error(400, `${campo} debe ser un número mayor o igual a cero`);
  }
  return mongoose.Types.Decimal128.fromString(numero.toFixed(2));
};

const fecha = (valor) => {
  if (valor === undefined || valor === null || valor === '') return new Date();
  const fechaValor = new Date(valor);
  if (Number.isNaN(fechaValor.getTime())) throw error(400, 'La fecha no es válida');
  return fechaValor;
};

const validarPedido = async (pedidoId) => {
  if (pedidoId === undefined || pedidoId === null || pedidoId === '') return null;

  if (!mongoose.isValidObjectId(pedidoId)) {
    throw error(400, 'El pedido indicado no es válido');
  }

  const existe = await Pedido.exists({ _id: pedidoId });
  if (!existe) throw error(400, 'El pedido indicado no existe');
  return pedidoId;
};

const listarFinanzas = async (req, res) => {
  try {
    const filtro = { activo: { $ne: false } };

    if (req.query.fuente && FUENTES_INGRESO.includes(req.query.fuente)) {
      filtro.fuenteIngreso = req.query.fuente;
    }

    if (req.query.desde || req.query.hasta) {
      filtro.fecha = {};
      if (req.query.desde) filtro.fecha.$gte = fecha(req.query.desde);
      if (req.query.hasta) filtro.fecha.$lte = fecha(req.query.hasta);
    }

    if (req.query.q) {
      const regex = new RegExp(String(req.query.q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filtro.$or = [{ fuenteIngreso: regex }];
    }

    if (req.query.pedido && mongoose.isValidObjectId(req.query.pedido)) {
      filtro.pedido = req.query.pedido;
    }

    const { items, paginacion } = await consultarPaginado(Finanza, filtro, {
      query: req.query,
      sort: { fecha: -1, createdAt: -1 },
      populate: [
        { path: 'usuario', select: 'nombre email' },
        {
          path: 'pedido',
          select: 'codigoPedido descripcion fechaEntrega estadoPedido producto cliente',
          populate: { path: 'cliente', select: 'nombre documento' },
        },
      ],
    });

    return responderPaginado(
      res,
      'Análisis financieros obtenidos correctamente',
      items,
      paginacion
    );
  } catch (caught) {
    return responderError(res, caught, 'Error al obtener los análisis financieros');
  }
};

const resumenFinanciero = async (req, res) => {
  try {
    const meses = Math.min(Math.max(Number(req.query.meses) || 6, 1), 12);
    const desde = new Date();
    desde.setMonth(desde.getMonth() - meses + 1);
    desde.setDate(1);
    desde.setHours(0, 0, 0, 0);

    const [totales, porFuente, porMes] = await Promise.all([
      Finanza.aggregate([
        { $match: { activo: { $ne: false }, fecha: { $gte: desde } } },
        {
          $group: {
            _id: null,
            ingresos: { $sum: { $toDouble: '$fuentesIngresos' } },
            gastos: { $sum: { $toDouble: '$gastos' } },
          },
        },
      ]),
      Finanza.aggregate([
        { $match: { activo: { $ne: false }, fecha: { $gte: desde } } },
        {
          $group: {
            _id: '$fuenteIngreso',
            ingresos: { $sum: { $toDouble: '$fuentesIngresos' } },
          },
        },
        { $sort: { ingresos: -1 } },
      ]),
      Finanza.aggregate([
        { $match: { activo: { $ne: false }, fecha: { $gte: desde } } },
        {
          $group: {
            _id: { anio: { $year: '$fecha' }, mes: { $month: '$fecha' } },
            ingresos: { $sum: { $toDouble: '$fuentesIngresos' } },
            gastos: { $sum: { $toDouble: '$gastos' } },
          },
        },
        { $sort: { '_id.anio': 1, '_id.mes': 1 } },
      ]),
    ]);

    const datos = totales[0] || { ingresos: 0, gastos: 0 };
    const balance = datos.ingresos - datos.gastos;

    return responder(res, 200, 'Resumen financiero obtenido correctamente', {
      periodoMeses: meses,
      ingresos: datos.ingresos,
      gastos: datos.gastos,
      balance,
      margen: datos.ingresos > 0 ? Number(((balance / datos.ingresos) * 100).toFixed(2)) : 0,
      porFuente,
      porMes,
    });
  } catch (caught) {
    return responderError(res, caught, 'Error al obtener el resumen financiero');
  }
};

const crearFinanza = async (req, res) => {
  try {
    const body = req.body || {};

    if (!FUENTES_INGRESO.includes(body.fuenteIngreso || 'directa')) {
      return responder(res, 400, `La fuente debe ser una de: ${FUENTES_INGRESO.join(', ')}`);
    }

    const pedido = await validarPedido(body.pedido);
    const finanza = await Finanza.create({
      fecha: fecha(body.fecha),
      pedido,
      fuenteIngreso: body.fuenteIngreso || 'directa',
      fuentesIngresos: decimal(body.fuentesIngresos ?? body.ingresos, 'Los ingresos'),
      gastos: decimal(body.gastos, 'Los gastos'),
      usuario: req.usuario._id,
      activo: true,
    });

    await registrarAuditoria(req, {
      accion: 'finanza.crear',
      entidad: 'Finanza',
      entidadId: finanza._id,
      detalle: `${finanza.fuenteIngreso} · ${finanza.fecha.toISOString().slice(0, 10)}${pedido ? ` · pedido ${pedido}` : ''}`,
    });

    return responder(res, 201, 'Análisis financiero creado correctamente', finanza);
  } catch (caught) {
    return responderError(res, caught, 'Error al crear el análisis financiero');
  }
};

const actualizarFinanza = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return responder(res, 400, 'El ID proporcionado no es válido');
    }

    const finanza = await Finanza.findById(req.params.id);
    if (!finanza) return responder(res, 404, 'Análisis financiero no encontrado');

    const body = req.body || {};

    if (body.fecha !== undefined) finanza.fecha = fecha(body.fecha);
    if (body.pedido !== undefined) {
      finanza.pedido = await validarPedido(body.pedido);
    }
    if (body.fuenteIngreso !== undefined) {
      if (!FUENTES_INGRESO.includes(body.fuenteIngreso)) {
        return responder(res, 400, `La fuente debe ser una de: ${FUENTES_INGRESO.join(', ')}`);
      }
      finanza.fuenteIngreso = body.fuenteIngreso;
    }
    if (body.fuentesIngresos !== undefined || body.ingresos !== undefined) {
      finanza.fuentesIngresos = decimal(
        body.fuentesIngresos !== undefined ? body.fuentesIngresos : body.ingresos,
        'Los ingresos'
      );
    }
    if (body.gastos !== undefined) finanza.gastos = decimal(body.gastos, 'Los gastos');
    if (body.activo !== undefined) finanza.activo = Boolean(body.activo);

    await finanza.save();

    await registrarAuditoria(req, {
      accion: 'finanza.actualizar',
      entidad: 'Finanza',
      entidadId: finanza._id,
      detalle: finanza.fuenteIngreso,
    });

    return responder(res, 200, 'Análisis financiero actualizado correctamente', finanza);
  } catch (caught) {
    return responderError(res, caught, 'Error al actualizar el análisis financiero');
  }
};

const eliminarFinanza = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return responder(res, 400, 'El ID proporcionado no es válido');
    }

    const finanza = await Finanza.findByIdAndUpdate(
      req.params.id,
      { activo: false },
      { new: true }
    );

    if (!finanza) return responder(res, 404, 'Análisis financiero no encontrado');

    await registrarAuditoria(req, {
      accion: 'finanza.desactivar',
      entidad: 'Finanza',
      entidadId: finanza._id,
      detalle: finanza.fuenteIngreso,
    });

    return responder(res, 200, 'Análisis financiero desactivado correctamente', finanza);
  } catch (caught) {
    return responderError(res, caught, 'Error al desactivar el análisis financiero');
  }
};

module.exports = {
  listarFinanzas,
  resumenFinanciero,
  crearFinanza,
  actualizarFinanza,
  eliminarFinanza,
};
