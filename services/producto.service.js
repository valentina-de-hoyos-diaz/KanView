const mongoose = require('mongoose');
const Producto = require('../models/producto.model');

const CATEGORIAS = Producto.schema.path('categoria').enumValues;

const LONGITUD_MAXIMA_NOMBRE = 200;
const LONGITUD_MAXIMA_CODIGO = 100;
const LONGITUD_MAXIMA_DESCRIPCION = 1000;

class ErrorDeProducto extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const esTextoValido = (valor, longitudMaxima) =>
  typeof valor === 'string' &&
  valor.trim().length > 0 &&
  valor.trim().length <= longitudMaxima;

const parsearPrecio = (precio) => {
  if (precio === undefined || precio === null || precio === '') {
    return null;
  }

  const numero = Number(precio);
  if (!Number.isFinite(numero) || numero < 0) {
    return null;
  }

  return mongoose.Types.Decimal128.fromString(numero.toFixed(2));
};

const parsearStock = (stock) => {
  const numero = Number(stock);
  if (!Number.isInteger(numero) || numero < 0) {
    return null;
  }

  return numero;
};

const normalizarDatos = (datos = {}, { parcial = false } = {}) => {
  const errores = [];
  const campos = {};

  const incluye = (campo) => !parcial || datos[campo] !== undefined;

  if (incluye('nombre')) {
    if (!esTextoValido(datos.nombre, LONGITUD_MAXIMA_NOMBRE)) {
      errores.push(`nombre (texto de 1 a ${LONGITUD_MAXIMA_NOMBRE} caracteres)`);
    } else {
      campos.nombre = datos.nombre.trim();
    }
  }

  if (incluye('codigoProducto')) {
    if (!esTextoValido(datos.codigoProducto, LONGITUD_MAXIMA_CODIGO)) {
      errores.push(`codigoProducto (texto de 1 a ${LONGITUD_MAXIMA_CODIGO} caracteres)`);
    } else {
      campos.codigoProducto = datos.codigoProducto.trim();
    }
  }

  if (incluye('descripcion')) {
    if (!esTextoValido(datos.descripcion, LONGITUD_MAXIMA_DESCRIPCION)) {
      errores.push(`descripcion (texto de 1 a ${LONGITUD_MAXIMA_DESCRIPCION} caracteres)`);
    } else {
      campos.descripcion = datos.descripcion.trim();
    }
  }

  if (incluye('categoria')) {
    if (!CATEGORIAS.includes(datos.categoria)) {
      errores.push(`categoria (debe ser una de: ${CATEGORIAS.join(', ')})`);
    } else {
      campos.categoria = datos.categoria;
    }
  }

  if (incluye('precio')) {
    const precio = parsearPrecio(datos.precio);
    if (precio === null) {
      errores.push('precio (número mayor o igual a 0)');
    } else {
      campos.precio = precio;
    }
  }

  if (incluye('stock')) {
    const stock = parsearStock(datos.stock);
    if (stock === null) {
      errores.push('stock (número entero mayor o igual a 0)');
    } else {
      campos.stock = stock;
    }
  }

  return { errores, campos };
};

const verificarCodigoDisponible = async (codigoProducto, idExcluido = null) => {
  const filtro = { codigoProducto };

  if (idExcluido) {
    filtro._id = { $ne: idExcluido };
  }

  const existente = await Producto.exists(filtro);

  if (existente) {
    throw new ErrorDeProducto(409, 'Ya existe un producto con ese código');
  }
};

const listarProductos = () => Producto.find().sort({ nombre: 1 });

const obtenerProductoPorId = async (id) => {
  const producto = await Producto.findById(id);

  if (!producto) {
    throw new ErrorDeProducto(404, 'Producto no encontrado');
  }

  return producto;
};

const crearProducto = async (datos) => {
  const { errores, campos } = normalizarDatos(datos);

  if (errores.length > 0) {
    throw new ErrorDeProducto(400, `Datos inválidos: ${errores.join(', ')}`);
  }

  await verificarCodigoDisponible(campos.codigoProducto);

  try {
    return await Producto.create(campos);
  } catch (error) {
    if (error.code === 11000) {
      throw new ErrorDeProducto(409, 'Ya existe un producto con ese código');
    }

    throw error;
  }
};

const actualizarProducto = async (id, datos) => {
  const { errores, campos } = normalizarDatos(datos, { parcial: true });

  if (errores.length > 0) {
    throw new ErrorDeProducto(400, `Datos inválidos: ${errores.join(', ')}`);
  }

  if (Object.keys(campos).length === 0) {
    throw new ErrorDeProducto(400, 'No se enviaron campos para actualizar');
  }

  if (campos.codigoProducto !== undefined) {
    await verificarCodigoDisponible(campos.codigoProducto, id);
  }

  let productoActualizado;

  try {
    productoActualizado = await Producto.findByIdAndUpdate(id, campos, {
      new: true,
      runValidators: true,
    });
  } catch (error) {
    if (error.code === 11000) {
      throw new ErrorDeProducto(409, 'Ya existe un producto con ese código');
    }

    throw error;
  }

  if (!productoActualizado) {
    throw new ErrorDeProducto(404, 'Producto no encontrado');
  }

  return productoActualizado;
};

const eliminarProducto = async (id) => {
  const productoEliminado = await Producto.findByIdAndDelete(id);

  if (!productoEliminado) {
    throw new ErrorDeProducto(404, 'Producto no encontrado');
  }

  return productoEliminado;
};

module.exports = {
  CATEGORIAS,
  ErrorDeProducto,
  normalizarDatos,
  listarProductos,
  obtenerProductoPorId,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
};
