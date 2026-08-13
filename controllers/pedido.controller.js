const mongoose = require('mongoose');
const Pedido = require('../models/pedido.model');

const { isValidObjectId } = mongoose;

const getPedidos = async (req, res) => {
  try {
    const pedidos = await Pedido.find().populate('cliente').populate('empleadoId');

    res.status(200).json({
      status: 200,
      message: 'Pedidos obtenidos correctamente',
      data: pedidos,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: 'Error al obtener los pedidos',
      data: { error: error.message },
    });
  }
};

const getPedidoById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        status: 400,
        message: 'El ID proporcionado no es válido',
        data: null,
      });
    }

    const pedido = await Pedido.findById(id).populate('cliente').populate('empleadoId');

    if (!pedido) {
      return res.status(404).json({
        status: 404,
        message: 'Pedido no encontrado',
        data: null,
      });
    }

    res.status(200).json({
      status: 200,
      message: 'Pedido obtenido correctamente',
      data: pedido,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: 'Error al obtener el pedido',
      data: { error: error.message },
    });
  }
};

const createPedido = async (req, res) => {
  try {
    const {
      codigoPedido,
      descripcion,
      cliente,
      empleadoId,
      estadoPedido,
      evidencia,
      fechaCreacion,
      horaCreacion,
      factura,
      producto,
    } = req.body;

    const camposRequeridos = {
      codigoPedido,
      descripcion,
      cliente,
      empleadoId,
      estadoPedido,
      evidencia,
      fechaCreacion,
      horaCreacion,
      factura,
      producto,
    };

    const faltantes = Object.keys(camposRequeridos).filter(
      (key) => camposRequeridos[key] === undefined || camposRequeridos[key] === null
    );

    if (faltantes.length > 0) {
      return res.status(400).json({
        status: 400,
        message: `Faltan campos requeridos: ${faltantes.join(', ')}`,
        data: null,
      });
    }

    if (!isValidObjectId(cliente)) {
      return res.status(400).json({
        status: 400,
        message: 'El campo cliente no es un ObjectId válido',
        data: null,
      });
    }

    if (!isValidObjectId(empleadoId)) {
      return res.status(400).json({
        status: 400,
        message: 'El campo empleadoId no es un ObjectId válido',
        data: null,
      });
    }

    const fechaCreacionDate = new Date(fechaCreacion);
    if (isNaN(fechaCreacionDate.getTime())) {
      return res.status(400).json({
        status: 400,
        message: 'fechaCreacion no es una fecha válida',
        data: null,
      });
    }

    const nuevoPedido = new Pedido({
      codigoPedido,
      descripcion,
      cliente,
      empleadoId,
      estadoPedido,
      evidencia,
      fechaCreacion: fechaCreacionDate,
      horaCreacion,
      factura,
      producto,
    });

    const pedidoGuardado = await nuevoPedido.save();

    res.status(201).json({
      status: 201,
      message: 'Pedido creado correctamente',
      data: pedidoGuardado,
    });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({
        status: 400,
        message: 'Error de validación',
        data: { error: error.message },
      });
    }

    res.status(500).json({
      status: 500,
      message: 'Error al crear el pedido',
      data: { error: error.message },
    });
  }
};

const updatePedido = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        status: 400,
        message: 'El ID proporcionado no es válido',
        data: null,
      });
    }

    const datos = { ...req.body };

    if (datos.cliente !== undefined && !isValidObjectId(datos.cliente)) {
      return res.status(400).json({
        status: 400,
        message: 'El campo cliente no es un ObjectId válido',
        data: null,
      });
    }

    if (datos.empleadoId !== undefined && !isValidObjectId(datos.empleadoId)) {
      return res.status(400).json({
        status: 400,
        message: 'El campo empleadoId no es un ObjectId válido',
        data: null,
      });
    }

    if (datos.fechaCreacion !== undefined) {
      const fecha = new Date(datos.fechaCreacion);
      if (isNaN(fecha.getTime())) {
        return res.status(400).json({
          status: 400,
          message: 'fechaCreacion no es una fecha válida',
          data: null,
        });
      }
      datos.fechaCreacion = fecha;
    }

    const pedidoActualizado = await Pedido.findByIdAndUpdate(id, datos, {
      new: true,
      runValidators: true,
    }).populate('cliente').populate('empleadoId');

    if (!pedidoActualizado) {
      return res.status(404).json({
        status: 404,
        message: 'Pedido no encontrado',
        data: null,
      });
    }

    res.status(200).json({
      status: 200,
      message: 'Pedido actualizado correctamente',
      data: pedidoActualizado,
    });
  } catch (error) {
    if (error instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({
        status: 400,
        message: 'Error de validación',
        data: { error: error.message },
      });
    }

    res.status(500).json({
      status: 500,
      message: 'Error al actualizar el pedido',
      data: { error: error.message },
    });
  }
};

const deletePedido = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        status: 400,
        message: 'El ID proporcionado no es válido',
        data: null,
      });
    }

    const pedidoEliminado = await Pedido.findByIdAndDelete(id);

    if (!pedidoEliminado) {
      return res.status(404).json({
        status: 404,
        message: 'Pedido no encontrado',
        data: null,
      });
    }

    res.status(200).json({
      status: 200,
      message: 'Pedido eliminado correctamente',
      data: pedidoEliminado,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: 'Error al eliminar el pedido',
      data: { error: error.message },
    });
  }
};

module.exports = {
  getPedidos,
  getPedidoById,
  createPedido,
  updatePedido,
  deletePedido,
};
