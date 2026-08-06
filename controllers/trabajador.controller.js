const mongoose = require('mongoose');
const Trabajador = require('../models/trabajador.model');

const { isValidObjectId, Types } = mongoose;

const getTrabajadores = async (req, res) => {
  try {
    const trabajadores = await Trabajador.find();
    res.status(200).json({
      status: 200,
      message: 'Trabajadores obtenidos correctamente',
      data: trabajadores,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: 'Error al obtener los trabajadores',
      data: { error: error.message },
    });
  }
};

const getTrabajadorById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        status: 400,
        message: 'El ID proporcionado no es válido',
        data: null,
      });
    }
    const trabajador = await Trabajador.findById(id);
    if (!trabajador) {
      return res.status(404).json({
        status: 404,
        message: 'Trabajador no encontrado',
        data: null,
      });
    }
    res.status(200).json({
      status: 200,
      message: 'Trabajador obtenido correctamente',
      data: trabajador,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: 'Error al obtener el trabajador',
      data: { error: error.message },
    });
  }
};

const createTrabajador = async (req, res) => {
  try {
    const {
      nombre,
      documento,
      celular,
      direccion,
      edad,
      fechaNacimiento,
      cargo,
      RH,
      salario,
      tareasRealizadas,
    } = req.body;

    const camposRequeridos = {
      nombre,
      documento,
      celular,
      direccion,
      edad,
      fechaNacimiento,
      cargo,
      RH,
      salario,
      tareasRealizadas,
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

    const salarioDecimal = Types.Decimal128.fromString(String(salario));
    const fechaNacimientoDate = new Date(fechaNacimiento);

    if (isNaN(fechaNacimientoDate.getTime())) {
      return res.status(400).json({
        status: 400,
        message: 'fechaNacimiento no es una fecha válida',
        data: null,
      });
    }

    const nuevoTrabajador = new Trabajador({
      nombre,
      documento,
      celular,
      direccion,
      edad,
      fechaNacimiento: fechaNacimientoDate,
      cargo,
      RH,
      salario: salarioDecimal,
      tareasRealizadas,
    });

    const trabajadorGuardado = await nuevoTrabajador.save();

    res.status(201).json({
      status: 201,
      message: 'Trabajador creado correctamente',
      data: trabajadorGuardado,
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
      message: 'Error al crear el trabajador',
      data: { error: error.message },
    });
  }
};

const updateTrabajador = async (req, res) => {
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

    if (datos.salario !== undefined) {
      datos.salario = Types.Decimal128.fromString(String(datos.salario));
    }

    if (datos.fechaNacimiento !== undefined) {
      const fecha = new Date(datos.fechaNacimiento);
      if (isNaN(fecha.getTime())) {
        return res.status(400).json({
          status: 400,
          message: 'fechaNacimiento no es una fecha válida',
          data: null,
        });
      }
      datos.fechaNacimiento = fecha;
    }

    const trabajadorActualizado = await Trabajador.findByIdAndUpdate(
      id,
      datos,
      { new: true, runValidators: true }
    );

    if (!trabajadorActualizado) {
      return res.status(404).json({
        status: 404,
        message: 'Trabajador no encontrado',
        data: null,
      });
    }

    res.status(200).json({
      status: 200,
      message: 'Trabajador actualizado correctamente',
      data: trabajadorActualizado,
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
      message: 'Error al actualizar el trabajador',
      data: { error: error.message },
    });
  }
};

const deleteTrabajador = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({
        status: 400,
        message: 'El ID proporcionado no es válido',
        data: null,
      });
    }

    const trabajadorEliminado = await Trabajador.findByIdAndDelete(id);

    if (!trabajadorEliminado) {
      return res.status(404).json({
        status: 404,
        message: 'Trabajador no encontrado',
        data: null,
      });
    }

    res.status(200).json({
      status: 200,
      message: 'Trabajador eliminado correctamente',
      data: trabajadorEliminado,
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: 'Error al eliminar el trabajador',
      data: { error: error.message },
    });
  }
};

module.exports = {
  getTrabajadores,
  getTrabajadorById,
  createTrabajador,
  updateTrabajador,
  deleteTrabajador,
};