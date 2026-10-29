const mongoose = require('mongoose');

const Pedido = require('../models/pedido.model');
const Cliente = require('../models/cliente.model');
const Trabajador = require('../models/trabajador.model');
const TareaPedido = require('../models/tareaPedido.model');
const EventoPedido = require('../models/eventoPedido.model');
const { siguienteCodigo } = require('../services/codigo.service');
const {
  ErrorDePedido,
  validarFechaEntrega,
  normalizarCantidad,
  registrarEventoPedido,
  resolverProducto,
  reservarStock,
  liberarStock,
} = require('../services/pedido.service');
const { registrarAuditoria } = require('../services/auditoria.service');
const {
  consultarPaginado,
  responderPaginado,
} = require('../services/paginacion.service');

const { isValidObjectId } = mongoose;

const ESTADOS_PEDIDO = Pedido.schema.path('estadoPedido').enumValues;
const ESTADOS_APROBACION = Pedido.schema.path('estadoAprobacion').enumValues;

const esSesionCliente = (req) =>
  Boolean(req.sesion && req.sesion.tipoUsuario === 'Cliente');

const responder = (res, status, message, data = null) =>
  res.status(status).json({ status, message, data });

const responderError = (res, error, contexto) => {
  if (error instanceof ErrorDePedido) {
    return responder(res, error.status, error.message);
  }

  if (error instanceof mongoose.Error.ValidationError) {
    return responder(res, 400, 'Error de validación', {
      error: error.message,
    });
  }

  if (error instanceof mongoose.Error.CastError) {
    return responder(res, 400, 'El ID proporcionado no es válido');
  }

  console.error(`[pedidos] ${contexto}:`, error.message);
  return responder(res, 500, contexto);
};

const escaparRegex = (texto) => String(texto).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const precioProducto = (producto) => Number(producto.precio.toString());

const construirProductoPedido = (productoCatalogo, cantidad, descripcion) => ({
  productoId: productoCatalogo._id,
  nombre: productoCatalogo.nombre,
  codigo: productoCatalogo.codigoProducto,
  descripcion,
  cantidad,
  precio: precioProducto(productoCatalogo),
  fecha_registro: new Date(),
});

const validarCliente = async (clienteId) => {
  if (!isValidObjectId(clienteId)) {
    throw new ErrorDePedido(400, 'El campo cliente no es un ObjectId válido');
  }

  const existe = await Cliente.exists({ _id: clienteId });

  if (!existe) {
    throw new ErrorDePedido(400, 'El cliente indicado no existe');
  }
};

const validarTrabajador = async (trabajadorId) => {
  if (trabajadorId === undefined || trabajadorId === null || trabajadorId === '') {
    return null;
  }

  if (!isValidObjectId(trabajadorId)) {
    throw new ErrorDePedido(400, 'El campo empleadoId no es un ObjectId válido');
  }

  const existe = await Trabajador.exists({ _id: trabajadorId });

  if (!existe) {
    throw new ErrorDePedido(400, 'El trabajador indicado no existe');
  }

  return trabajadorId;
};

const filtroPedidos = (req) => {
  const filtro = {};

  if (esSesionCliente(req)) {
    filtro.cliente = req.usuario._id;
  } else if (req.query.cliente && isValidObjectId(req.query.cliente)) {
    filtro.cliente = req.query.cliente;
  }

  if (req.query.estado && ESTADOS_PEDIDO.includes(req.query.estado)) {
    filtro.estadoPedido = req.query.estado;
  }

  if (req.query.aprobacion && ESTADOS_APROBACION.includes(req.query.aprobacion)) {
    filtro.estadoAprobacion = req.query.aprobacion;
  }

  const incluirInactivos =
    !esSesionCliente(req) && String(req.query.incluirInactivos) === 'true';

  if (!incluirInactivos) {
    filtro.activo = true;
  }

  if (req.query.q) {
    const regex = new RegExp(escaparRegex(req.query.q), 'i');
    filtro.$or = [
      { codigoPedido: regex },
      { descripcion: regex },
      { 'producto.nombre': regex },
      { 'producto.codigo': regex },
    ];
  }

  return filtro;
};

const getPedidos = async (req, res) => {
  try {
    const { items, paginacion } = await consultarPaginado(Pedido, filtroPedidos(req), {
      query: req.query,
      sort: { fechaCreacion: -1, createdAt: -1 },
      populate: [
        'cliente',
        'empleadoId',
        'usuarioCreador',
        { path: 'aprobadoPor', select: 'nombre email rol' },
      ],
    });

    return responderPaginado(res, 'Pedidos obtenidos correctamente', items, paginacion);
  } catch (error) {
    return responderError(res, error, 'Error al obtener los pedidos');
  }
};

const getPedidoById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return responder(res, 400, 'El ID proporcionado no es válido');
    }

    const filtro = esSesionCliente(req) ? { _id: id, cliente: req.usuario._id } : { _id: id };
    const pedido = await Pedido.findOne(filtro)
      .populate('cliente')
      .populate('empleadoId')
      .populate('usuarioCreador')
      .populate('aprobadoPor', 'nombre email rol');

    if (!pedido) {
      return responder(res, 404, 'Pedido no encontrado');
    }

    return responder(res, 200, 'Pedido obtenido correctamente', pedido);
  } catch (error) {
    return responderError(res, error, 'Error al obtener el pedido');
  }
};

const createPedido = async (req, res) => {
  const body = req.body || {};
  let stockReservado = null;

  try {
    if (!req.usuario) {
      return responder(res, 401, 'Se requiere un usuario autenticado para crear el pedido');
    }

    const descripcion = typeof body.descripcion === 'string' ? body.descripcion.trim() : '';
    if (!descripcion) {
      return responder(res, 400, 'La descripción del pedido es obligatoria');
    }

    if (!body.producto) {
      return responder(res, 400, 'El producto es obligatorio');
    }

    const productoCatalogo = await resolverProducto(body.producto);
    const cantidad = normalizarCantidad(body.producto.cantidad ?? body.cantidad);
    const ahora = new Date();
    const fechaEntrega = validarFechaEntrega(body.fechaEntrega, ahora);

    const clienteId = esSesionCliente(req) ? req.usuario._id : body.cliente;
    if (!esSesionCliente(req)) {
      await validarCliente(clienteId);
    }

    const empleadoId = esSesionCliente(req) ? null : await validarTrabajador(body.empleadoId);

    const estadoAprobacion = esSesionCliente(req)
      ? 'Pendiente'
      : body.estadoAprobacion === 'Pendiente'
        ? 'Pendiente'
        : 'Aprobado';

    await reservarStock(productoCatalogo._id, cantidad);
    stockReservado = { productoId: productoCatalogo._id, cantidad };

    const codigoPedido = await siguienteCodigo('pedido', 'PED');
    const nuevoPedido = new Pedido({
      codigoPedido,
      descripcion,
      cliente: clienteId,
      empleadoId: empleadoId || undefined,
      estadoPedido: 'Pendiente',
      estadoAprobacion,
      fechaCreacion: ahora,
      horaCreacion: ahora.toTimeString().slice(0, 5),
      fechaEntrega,
      producto: construirProductoPedido(productoCatalogo, cantidad, descripcion),
      usuarioCreador: req.usuario._id,
      tipoUsuarioCreador: esSesionCliente(req) ? 'Cliente' : 'Usuario',
    });

    const pedidoGuardado = await nuevoPedido.save();
    stockReservado = null;

    await pedidoGuardado.populate('cliente');
    await pedidoGuardado.populate('empleadoId');
    await pedidoGuardado.populate('usuarioCreador');

    await registrarEventoPedido(
      req,
      pedidoGuardado._id,
      'creacion',
      `Pedido ${pedidoGuardado.codigoPedido} creado por ${esSesionCliente(req) ? 'el cliente' : 'el taller'}`
    );

    await registrarAuditoria(req, {
      accion: 'pedido.crear',
      entidad: 'Pedido',
      entidadId: pedidoGuardado._id,
      detalle: `${pedidoGuardado.codigoPedido} · ${productoCatalogo.nombre} x${cantidad}`,
    });

    return responder(res, 201, 'Pedido creado correctamente', pedidoGuardado);
  } catch (error) {
    if (stockReservado) {
      await liberarStock(stockReservado.productoId, stockReservado.cantidad).catch((liberarError) =>
        console.error('[pedidos] No se pudo revertir el stock:', liberarError.message)
      );
    }

    return responderError(res, error, 'Error al crear el pedido');
  }
};

const updatePedido = async (req, res) => {
  let reservaAplicada = null;
  let liberacionAplicada = null;

  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return responder(res, 400, 'El ID proporcionado no es válido');
    }

    const pedido = await Pedido.findById(id);

    if (!pedido) {
      return responder(res, 404, 'Pedido no encontrado');
    }

    const body = req.body || {};
    const rol = req.usuario ? req.usuario.rol : null;

    if (body.estadoPedido !== undefined && !ESTADOS_PEDIDO.includes(body.estadoPedido)) {
      return responder(
        res,
        400,
        `estadoPedido debe ser uno de: ${ESTADOS_PEDIDO.join(', ')}`
      );
    }

    if (body.estadoPedido !== undefined && rol !== 'admin') {
      return responder(res, 403, 'Solo el Administrador puede mover tarjetas del tablero');
    }

    if (body.cliente !== undefined) {
      await validarCliente(body.cliente);
      pedido.cliente = body.cliente;
    }

    if (body.empleadoId !== undefined) {
      pedido.empleadoId = (await validarTrabajador(body.empleadoId)) || undefined;
    }

    const productoAnteriorId = pedido.producto ? pedido.producto.productoId : null;
    const cantidadAnterior = pedido.producto ? pedido.producto.cantidad : 0;

    let productoCatalogo = null;
    if (body.producto !== undefined) {
      productoCatalogo = await resolverProducto(body.producto);
    }

    const cantidadNueva = normalizarCantidad(
      body.producto && body.producto.cantidad !== undefined
        ? body.producto.cantidad
        : body.cantidad !== undefined
          ? body.cantidad
          : cantidadAnterior || 1
    );

    const nuevoActivo = body.activo !== undefined ? Boolean(body.activo) : pedido.activo;
    const nuevoEstado = body.estadoPedido !== undefined ? body.estadoPedido : pedido.estadoPedido;
    const productoNuevoId = productoCatalogo ? productoCatalogo._id : productoAnteriorId;
    const estabaReservado = pedido.activo && pedido.estadoPedido !== 'Cancelado';
    const estaraReservado = nuevoActivo && nuevoEstado !== 'Cancelado';

    if (nuevoEstado === 'Completado' && pedido.estadoPedido !== 'Completado') {
      const tareasPendientes = await TareaPedido.countDocuments({
        idPedido: pedido._id,
        activo: { $ne: false },
        estado: { $nin: ['Completado', 'Cancelado'] },
      });

      if (tareasPendientes > 0) {
        return responder(
          res,
          409,
          `No se puede completar el pedido: tiene ${tareasPendientes} tarea(s) pendiente(s)`
        );
      }
    }

    if (productoAnteriorId && productoNuevoId) {
      if (estabaReservado && estaraReservado) {
        if (!productoNuevoId.equals(productoAnteriorId)) {
          await reservarStock(productoNuevoId, cantidadNueva);
          reservaAplicada = { productoId: productoNuevoId, cantidad: cantidadNueva };
          await liberarStock(productoAnteriorId, cantidadAnterior);
          liberacionAplicada = { productoId: productoAnteriorId, cantidad: cantidadAnterior };
        } else if (cantidadNueva > cantidadAnterior) {
          const diferencia = cantidadNueva - cantidadAnterior;
          await reservarStock(productoNuevoId, diferencia);
          reservaAplicada = { productoId: productoNuevoId, cantidad: diferencia };
        } else if (cantidadNueva < cantidadAnterior) {
          const diferencia = cantidadAnterior - cantidadNueva;
          await liberarStock(productoAnteriorId, diferencia);
          liberacionAplicada = { productoId: productoAnteriorId, cantidad: diferencia };
        }
      } else if (!estabaReservado && estaraReservado) {
        await reservarStock(productoNuevoId, cantidadNueva);
        reservaAplicada = { productoId: productoNuevoId, cantidad: cantidadNueva };
      } else if (estabaReservado && !estaraReservado) {
        await liberarStock(productoAnteriorId, cantidadAnterior);
        liberacionAplicada = { productoId: productoAnteriorId, cantidad: cantidadAnterior };
      }
    }

    if (productoCatalogo) {
      pedido.producto = construirProductoPedido(
        productoCatalogo,
        cantidadNueva,
        typeof body.producto.descripcion === 'string' && body.producto.descripcion.trim()
          ? body.producto.descripcion.trim()
          : body.descripcion || pedido.descripcion
      );
    } else if (body.cantidad !== undefined && pedido.producto) {
      pedido.producto.cantidad = cantidadNueva;
    }

    if (typeof body.descripcion === 'string' && body.descripcion.trim()) {
      pedido.descripcion = body.descripcion.trim();
    }

    if (body.estadoPedido !== undefined) {
      pedido.estadoPedido = body.estadoPedido;
    }

    if (body.activo !== undefined) {
      pedido.activo = Boolean(body.activo);
    }

    if (body.fechaEntrega !== undefined) {
      pedido.fechaEntrega = validarFechaEntrega(body.fechaEntrega, pedido.fechaCreacion);
    }

    await pedido.save();
    reservaAplicada = null;
    liberacionAplicada = null;

    await pedido.populate('cliente');
    await pedido.populate('empleadoId');
    await pedido.populate('usuarioCreador');

    await registrarEventoPedido(
      req,
      pedido._id,
      'actualizacion',
      body.estadoPedido
        ? `Estado cambiado a ${body.estadoPedido}`
        : 'Datos del pedido actualizados'
    );

    await registrarAuditoria(req, {
      accion: 'pedido.actualizar',
      entidad: 'Pedido',
      entidadId: pedido._id,
      detalle: body.estadoPedido
        ? `${pedido.codigoPedido} · estado ${body.estadoPedido}`
        : pedido.codigoPedido,
    });

    return responder(res, 200, 'Pedido actualizado correctamente', pedido);
  } catch (error) {
    if (reservaAplicada) {
      await liberarStock(reservaAplicada.productoId, reservaAplicada.cantidad).catch((liberarError) =>
        console.error('[pedidos] No se pudo revertir la reserva:', liberarError.message)
      );
    }

    if (liberacionAplicada) {
      await reservarStock(liberacionAplicada.productoId, liberacionAplicada.cantidad).catch(
        (reservarError) =>
          console.error('[pedidos] No se pudo revertir la liberación:', reservarError.message)
      );
    }

    return responderError(res, error, 'Error al actualizar el pedido');
  }
};

const deletePedido = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return responder(res, 400, 'El ID proporcionado no es válido');
    }

    const pedido = await Pedido.findById(id);

    if (!pedido) {
      return responder(res, 404, 'Pedido no encontrado');
    }

    if (pedido.activo && pedido.estadoPedido !== 'Cancelado' && pedido.producto) {
      await liberarStock(pedido.producto.productoId, pedido.producto.cantidad);
    }

    pedido.activo = false;
    pedido.estadoPedido = 'Cancelado';
    await pedido.save();

    await registrarEventoPedido(req, pedido._id, 'desactivacion', 'Pedido desactivado');
    await registrarAuditoria(req, {
      accion: 'pedido.desactivar',
      entidad: 'Pedido',
      entidadId: pedido._id,
      detalle: pedido.codigoPedido,
    });

    return responder(res, 200, 'Pedido desactivado correctamente', pedido);
  } catch (error) {
    return responderError(res, error, 'Error al eliminar el pedido');
  }
};

const reactivarPedido = async (req, res) => {
  let reserva = null;

  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return responder(res, 400, 'El ID proporcionado no es válido');
    }

    const pedido = await Pedido.findById(id);

    if (!pedido) {
      return responder(res, 404, 'Pedido no encontrado');
    }

    if (pedido.activo && pedido.estadoPedido !== 'Cancelado') {
      return responder(res, 400, 'El pedido ya está activo');
    }

    if (pedido.producto) {
      await reservarStock(pedido.producto.productoId, pedido.producto.cantidad);
      reserva = { productoId: pedido.producto.productoId, cantidad: pedido.producto.cantidad };
    }

    pedido.activo = true;
    pedido.estadoPedido = 'Pendiente';
    if (pedido.estadoAprobacion === 'Rechazado') {
      pedido.estadoAprobacion = 'Pendiente';
      pedido.motivoRechazo = '';
      pedido.fechaAprobacion = null;
      pedido.aprobadoPor = null;
    }
    await pedido.save();
    reserva = null;

    await registrarEventoPedido(req, pedido._id, 'reactivacion', 'Pedido reactivado');
    await registrarAuditoria(req, {
      accion: 'pedido.reactivar',
      entidad: 'Pedido',
      entidadId: pedido._id,
      detalle: pedido.codigoPedido,
    });

    return responder(res, 200, 'Pedido reactivado correctamente', pedido);
  } catch (error) {
    if (reserva) {
      await liberarStock(reserva.productoId, reserva.cantidad).catch((liberarError) =>
        console.error('[pedidos] No se pudo revertir la reserva:', liberarError.message)
      );
    }

    return responderError(res, error, 'Error al reactivar el pedido');
  }
};

const aprobarPedido = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return responder(res, 400, 'El ID proporcionado no es válido');
    }

    const pedido = await Pedido.findById(id);

    if (!pedido) {
      return responder(res, 404, 'Pedido no encontrado');
    }

    if (!pedido.activo) {
      return responder(res, 400, 'No se puede aprobar un pedido desactivado');
    }

    if (pedido.estadoAprobacion === 'Aprobado') {
      return responder(res, 400, 'El pedido ya está aprobado');
    }

    const empleadoId = await validarTrabajador(req.body ? req.body.empleadoId : null);

    if (pedido.estadoAprobacion === 'Rechazado' && pedido.producto) {
      await reservarStock(pedido.producto.productoId, pedido.producto.cantidad);
    }

    pedido.estadoAprobacion = 'Aprobado';
    pedido.motivoRechazo = '';
    pedido.aprobadoPor = req.usuario._id;
    pedido.fechaAprobacion = new Date();
    if (empleadoId) pedido.empleadoId = empleadoId;
    if (pedido.estadoPedido === 'Cancelado') pedido.estadoPedido = 'Pendiente';
    await pedido.save();

    await registrarEventoPedido(
      req,
      pedido._id,
      'aprobacion',
      empleadoId ? 'Pedido aprobado y trabajador asignado' : 'Pedido aprobado'
    );
    await registrarAuditoria(req, {
      accion: 'pedido.aprobar',
      entidad: 'Pedido',
      entidadId: pedido._id,
      detalle: pedido.codigoPedido,
    });

    return responder(res, 200, 'Pedido aprobado correctamente', pedido);
  } catch (error) {
    return responderError(res, error, 'Error al aprobar el pedido');
  }
};

const rechazarPedido = async (req, res) => {
  try {
    const { id } = req.params;
    const motivo = req.body && typeof req.body.motivo === 'string' ? req.body.motivo.trim() : '';

    if (!isValidObjectId(id)) {
      return responder(res, 400, 'El ID proporcionado no es válido');
    }

    if (!motivo) {
      return responder(res, 400, 'El motivo del rechazo es obligatorio');
    }

    const pedido = await Pedido.findById(id);

    if (!pedido) {
      return responder(res, 404, 'Pedido no encontrado');
    }

    if (pedido.activo && pedido.estadoPedido !== 'Cancelado' && pedido.producto) {
      await liberarStock(pedido.producto.productoId, pedido.producto.cantidad);
    }

    pedido.estadoAprobacion = 'Rechazado';
    pedido.estadoPedido = 'Cancelado';
    pedido.motivoRechazo = motivo;
    pedido.aprobadoPor = req.usuario._id;
    pedido.fechaAprobacion = new Date();
    await pedido.save();

    await registrarEventoPedido(req, pedido._id, 'rechazo', motivo);
    await registrarAuditoria(req, {
      accion: 'pedido.rechazar',
      entidad: 'Pedido',
      entidadId: pedido._id,
      detalle: `${pedido.codigoPedido} · ${motivo}`,
    });

    return responder(res, 200, 'Pedido rechazado correctamente', pedido);
  } catch (error) {
    return responderError(res, error, 'Error al rechazar el pedido');
  }
};

const getHistorialPedido = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return responder(res, 400, 'El ID proporcionado no es válido');
    }

    const filtro = esSesionCliente(req)
      ? { _id: id, cliente: req.usuario._id }
      : { _id: id };

    const pedido = await Pedido.findOne(filtro).select('_id');

    if (!pedido) {
      return responder(res, 404, 'Pedido no encontrado');
    }

    const eventos = await EventoPedido.find({ pedido: id })
      .populate('usuario', 'nombre email rol')
      .sort({ createdAt: 1 });

    return responder(res, 200, 'Historial obtenido correctamente', eventos);
  } catch (error) {
    return responderError(res, error, 'Error al obtener el historial del pedido');
  }
};

module.exports = {
  getPedidos,
  getPedidoById,
  createPedido,
  updatePedido,
  deletePedido,
  reactivarPedido,
  aprobarPedido,
  rechazarPedido,
  getHistorialPedido,
};
