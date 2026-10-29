const mongoose = require('mongoose');
const EventoPedido = require('../models/eventoPedido.model');

class ErrorDePedido extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const esFechaValida = (valor) => {
  if (valor === undefined || valor === null || valor === '') return null;
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
};

const soloFecha = (fecha) =>
  new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()));

const validarFechaEntrega = (fechaEntrega, fechaCreacion) => {
  const entrega = esFechaValida(fechaEntrega);

  if (fechaEntrega !== undefined && fechaEntrega !== null && fechaEntrega !== '' && !entrega) {
    throw new ErrorDePedido(400, 'La fecha de entrega no es válida');
  }

  if (entrega && fechaCreacion && soloFecha(entrega) < soloFecha(new Date(fechaCreacion))) {
    throw new ErrorDePedido(
      400,
      'La fecha de entrega no puede ser anterior a la fecha de creación'
    );
  }

  return entrega;
};

const normalizarCantidad = (valor) => {
  if (valor === undefined || valor === null || valor === '') return 1;
  const cantidad = Number(valor);
  if (!Number.isInteger(cantidad) || cantidad < 1) {
    throw new ErrorDePedido(400, 'La cantidad debe ser un entero mayor que cero');
  }
  return cantidad;
};

const datosActor = (req) => {
  if (!req || !req.sesion) {
    return { usuario: null, tipoUsuario: 'Sistema' };
  }

  const referencia = req.sesion.usuario;
  const usuarioId = referencia && referencia._id ? referencia._id : referencia;

  return {
    usuario: usuarioId || null,
    tipoUsuario: req.sesion.tipoUsuario || 'Usuario',
  };
};

const registrarEventoPedido = async (req, pedidoId, accion, detalle = '') => {
  const actor = datosActor(req);
  try {
    await EventoPedido.create({
      pedido: pedidoId,
      accion,
      detalle,
      usuario: actor.usuario,
      tipoUsuario: actor.tipoUsuario,
    });
  } catch (error) {
    console.error(`[pedidos] No se pudo registrar el evento "${accion}":`, error.message);
  }
};

const Producto = require('../models/producto.model');

const resolverProducto = async (producto = {}) => {
  const productoId =
    typeof producto.productoId === 'string'
      ? producto.productoId
      : typeof producto._id === 'string'
        ? producto._id
        : null;

  if (productoId) {
    if (!mongoose.isValidObjectId(productoId)) {
      throw new ErrorDePedido(400, 'El producto indicado no es válido');
    }
    const encontrado = await Producto.findById(productoId);
    if (!encontrado) {
      throw new ErrorDePedido(400, 'El producto seleccionado no existe en el catálogo');
    }
    return encontrado;
  }

  const codigo = typeof producto.codigo === 'string' ? producto.codigo.trim() : '';
  if (codigo) {
    const encontrado = await Producto.findOne({ codigoProducto: codigo });
    if (!encontrado) {
      throw new ErrorDePedido(400, 'El producto seleccionado no existe en el catálogo');
    }
    return encontrado;
  }

  const nombre = typeof producto.nombre === 'string' ? producto.nombre.trim() : '';
  if (nombre) {
    const encontrado = await Producto.findOne({ nombre });
    if (!encontrado) {
      throw new ErrorDePedido(400, 'El producto seleccionado no existe en el catálogo');
    }
    return encontrado;
  }

  throw new ErrorDePedido(400, 'El producto es obligatorio');
};

const reservarStock = async (productoId, cantidad) => {
  const producto = await Producto.findOneAndUpdate(
    { _id: productoId, stock: { $gte: cantidad } },
    { $inc: { stock: -cantidad } },
    { new: true }
  );

  if (!producto) {
    throw new ErrorDePedido(
      409,
      'No hay suficientes unidades disponibles del producto seleccionado'
    );
  }

  return producto;
};

const liberarStock = async (productoId, cantidad) => {
  if (!productoId || !cantidad) return;
  await Producto.updateOne({ _id: productoId }, { $inc: { stock: cantidad } });
};

const calcularAjusteStock = ({
  productoAnteriorId,
  cantidadAnterior,
  productoNuevoId,
  cantidadNueva,
}) => {
  if (productoAnteriorId && productoAnteriorId.equals(productoNuevoId)) {
    return { reservar: Math.max(cantidadNueva - cantidadAnterior, 0), liberar: Math.max(cantidadAnterior - cantidadNueva, 0) };
  }

  return { reservar: cantidadNueva, liberar: cantidadAnterior };
};

module.exports = {
  ErrorDePedido,
  validarFechaEntrega,
  normalizarCantidad,
  registrarEventoPedido,
  resolverProducto,
  reservarStock,
  liberarStock,
  calcularAjusteStock,
};
