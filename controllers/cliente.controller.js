const mongoose = require('mongoose');
const Cliente = require('../models/cliente.model');
const {
  hashPassword,
  LONGITUD_MINIMA_PASSWORD,
  LONGITUD_MAXIMA_PASSWORD,
  longitudPasswordValida,
} = require('../services/autenticacion.service');

const { isValidObjectId } = mongoose;

const extraerCampos = (body) => ({
  nombre: body.nombre,
  documento: body.documento,
  celular: body.celular,
  direccion: body.direccion,
  edad: body.edad,
  fechaNacimiento: body.fechaNacimiento,
});

const getClientes = async (req, res) => {
  try {
    const clientes = await Cliente.find();

    res.status(200).json({
      status: 200,
      message: 'Clientes obtenidos correctamente',
      data: clientes,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: 'Error al obtener los clientes',
      data: { error: error.message },
    });
  }
};

const getClienteById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        status: 400,
        message: 'El ID proporcionado no es válido',
        data: null,
      });
    }

    const cliente = await Cliente.findById(id);

    if (!cliente) {
      return res.status(404).json({
        status: 404,
        message: 'Cliente no encontrado',
        data: null,
      });
    }

    res.status(200).json({
      status: 200,
      message: 'Cliente obtenido correctamente',
      data: cliente,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: 'Error al obtener el cliente',
      data: { error: error.message },
    });
  }
};

const createCliente = async (req, res) => {
  try {
    const campos = extraerCampos(req.body);

    const faltantes = Object.keys(campos).filter(
      (key) => campos[key] === undefined || campos[key] === null
    );

    if (faltantes.length > 0) {
      return res.status(400).json({
        status: 400,
        message: `Faltan campos requeridos: ${faltantes.join(', ')}`,
        data: null,
      });
    }

    const { password } = req.body;

    if (password === undefined || password === null || password === '') {
      return res.status(400).json({
        status: 400,
        message: 'La contraseña es obligatoria',
        data: null,
      });
    }

    if (!longitudPasswordValida(password)) {
      return res.status(400).json({
        status: 400,
        message: `La contraseña debe tener entre ${LONGITUD_MINIMA_PASSWORD} y ${LONGITUD_MAXIMA_PASSWORD} caracteres`,
        data: null,
      });
    }

    const fechaNacimiento = new Date(campos.fechaNacimiento);
    if (isNaN(fechaNacimiento.getTime())) {
      return res.status(400).json({
        status: 400,
        message: 'fechaNacimiento no es una fecha válida',
        data: null,
      });
    }

    const nuevoCliente = new Cliente({
      ...campos,
      fechaNacimiento,
      password: await hashPassword(password),
    });
    const clienteGuardado = await nuevoCliente.save();

    res.status(201).json({
      status: 201,
      message: 'Cliente creado correctamente',
      data: clienteGuardado,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        status: 409,
        message: 'Ya existe un cliente con ese documento',
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

    res.status(500).json({
      status: 500,
      message: 'Error al crear el cliente',
      data: { error: error.message },
    });
  }
};

const updateCliente = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        status: 400,
        message: 'El ID proporcionado no es válido',
        data: null,
      });
    }

    const campos = extraerCampos(req.body);
    const datos = {};

    Object.keys(campos).forEach((campo) => {
      if (campos[campo] !== undefined) {
        datos[campo] = campos[campo];
      }
    });

    if (datos.fechaNacimiento !== undefined) {
      const fechaNacimiento = new Date(datos.fechaNacimiento);
      if (isNaN(fechaNacimiento.getTime())) {
        return res.status(400).json({
          status: 400,
          message: 'fechaNacimiento no es una fecha válida',
          data: null,
        });
      }
      datos.fechaNacimiento = fechaNacimiento;
    }

    const { password } = req.body;

    if (password !== undefined && password !== '') {
      if (!longitudPasswordValida(password)) {
        return res.status(400).json({
          status: 400,
          message: `La contraseña debe tener entre ${LONGITUD_MINIMA_PASSWORD} y ${LONGITUD_MAXIMA_PASSWORD} caracteres`,
          data: null,
        });
      }

      datos.password = await hashPassword(password);
    }

    const clienteActualizado = await Cliente.findByIdAndUpdate(id, datos, {
      new: true,
      runValidators: true,
    });

    if (!clienteActualizado) {
      return res.status(404).json({
        status: 404,
        message: 'Cliente no encontrado',
        data: null,
      });
    }

    res.status(200).json({
      status: 200,
      message: 'Cliente actualizado correctamente',
      data: clienteActualizado,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        status: 409,
        message: 'Ya existe un cliente con ese documento',
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

    res.status(500).json({
      status: 500,
      message: 'Error al actualizar el cliente',
      data: { error: error.message },
    });
  }
};

const deleteCliente = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        status: 400,
        message: 'El ID proporcionado no es válido',
        data: null,
      });
    }

    const clienteEliminado = await Cliente.findByIdAndDelete(id);

    if (!clienteEliminado) {
      return res.status(404).json({
        status: 404,
        message: 'Cliente no encontrado',
        data: null,
      });
    }

    res.status(200).json({
      status: 200,
      message: 'Cliente eliminado correctamente',
      data: clienteEliminado,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: 'Error al eliminar el cliente',
      data: { error: error.message },
    });
  }
};

module.exports = {
  getClientes,
  getClienteById,
  createCliente,
  updateCliente,
  deleteCliente,
};
