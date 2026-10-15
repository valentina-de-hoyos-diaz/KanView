const mongoose = require('mongoose');
const productoService = require('../services/producto.service');

const { isValidObjectId } = mongoose;

const responderError = (res, error, mensajeGenerico) => {
  if (error instanceof productoService.ErrorDeProducto) {
    return res.status(error.status).json({
      status: error.status,
      message: error.message,
      data: null,
    });
  }

  if (error instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({
      status: 400,
      message: 'Error de validación',
      data: { error: error.message },
    });
  }

  console.error('[productos]', mensajeGenerico, error.message);

  return res.status(500).json({
    status: 500,
    message: mensajeGenerico,
    data: { error: error.message },
  });
};

const validarId = (req, res) => {
  if (!isValidObjectId(req.params.id)) {
    res.status(400).json({
      status: 400,
      message: 'El ID proporcionado no es válido',
      data: null,
    });
    return false;
  }

  return true;
};

const getProductos = async (req, res) => {
  try {
    const productos = await productoService.listarProductos();

    res.status(200).json({
      status: 200,
      message: 'Productos obtenidos correctamente',
      data: productos,
    });
  } catch (error) {
    responderError(res, error, 'Error al obtener los productos');
  }
};

const getProductoById = async (req, res) => {
  try {
    if (!validarId(req, res)) return;

    const producto = await productoService.obtenerProductoPorId(req.params.id);

    res.status(200).json({
      status: 200,
      message: 'Producto obtenido correctamente',
      data: producto,
    });
  } catch (error) {
    responderError(res, error, 'Error al obtener el producto');
  }
};

const createProducto = async (req, res) => {
  try {
    const producto = await productoService.crearProducto(req.body);

    res.status(201).json({
      status: 201,
      message: 'Producto creado correctamente',
      data: producto,
    });
  } catch (error) {
    responderError(res, error, 'Error al crear el producto');
  }
};

const updateProducto = async (req, res) => {
  try {
    if (!validarId(req, res)) return;

    const producto = await productoService.actualizarProducto(req.params.id, req.body);

    res.status(200).json({
      status: 200,
      message: 'Producto actualizado correctamente',
      data: producto,
    });
  } catch (error) {
    responderError(res, error, 'Error al actualizar el producto');
  }
};

const deleteProducto = async (req, res) => {
  try {
    if (!validarId(req, res)) return;

    const producto = await productoService.eliminarProducto(req.params.id);

    res.status(200).json({
      status: 200,
      message: 'Producto eliminado correctamente',
      data: producto,
    });
  } catch (error) {
    responderError(res, error, 'Error al eliminar el producto');
  }
};

module.exports = {
  getProductos,
  getProductoById,
  createProducto,
  updateProducto,
  deleteProducto,
};
