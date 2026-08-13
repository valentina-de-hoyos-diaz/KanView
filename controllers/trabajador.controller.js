// Importación de mongoose y del modelo Trabajador
const mongoose = require('mongoose');
const Trabajador = require('../models/trabajador.model');

// Extrae Decimal128 para el campo salario
const { Types } = mongoose;

// Obtiene todos los trabajadores de la colección y los retorna en formato JSON
exports.getTrabajadores = async (req, res) => {
  try {
    const trabajadores = await Trabajador.find();
    res.status(200).json(trabajadores);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Busca un trabajador por su documento (recibido como req.params.id desde el router)
// Si no existe, responde con 404
exports.getTrabajadorById = async (req, res) => {
  try {
    const trabajador = await Trabajador.findOne({ documento: req.params.id });
    if (!trabajador) {
      return res.status(404).json({ error: 'Trabajador no encontrado' });
    }
    res.status(200).json(trabajador);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Registra un nuevo trabajador
exports.createTrabajador = async (req, res) => {
  try {
    // Arma el objeto con los 10 campos del modelo a partir del body
    let nuevoTrabajador = {
      nombre: req.body.nombre,
      documento: req.body.documento,
      celular: req.body.celular,
      direccion: req.body.direccion,
      edad: req.body.edad,
      fechaNacimiento: req.body.fechaNacimiento,
      cargo: req.body.cargo,
      RH: req.body.RH,
      salario: req.body.salario,
      tareasRealizadas: req.body.tareasRealizadas,
    };

    // Convierte salario a Decimal128 (tipo del modelo)
    if (nuevoTrabajador.salario !== undefined) {
      nuevoTrabajador.salario = Types.Decimal128.fromString(String(nuevoTrabajador.salario));
    }

    // Convierte fechaNacimiento a tipo Date
    if (nuevoTrabajador.fechaNacimiento !== undefined) {
      nuevoTrabajador.fechaNacimiento = new Date(nuevoTrabajador.fechaNacimiento);
    }

    // Crea el documento en la base y responde 201
    const trabajadorGuardado = await Trabajador.create(nuevoTrabajador);
    res.status(201).json(trabajadorGuardado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Actualiza un trabajador existente
exports.updateTrabajador = async (req, res) => {
  try {
    // Arma el objeto con los campos a actualizar desde el body
    let datos = {
      nombre: req.body.nombre,
      documento: req.body.documento,
      celular: req.body.celular,
      direccion: req.body.direccion,
      edad: req.body.edad,
      fechaNacimiento: req.body.fechaNacimiento,
      cargo: req.body.cargo,
      RH: req.body.RH,
      salario: req.body.salario,
      tareasRealizadas: req.body.tareasRealizadas,
    };

    // Aplica las mismas conversiones de salario y fechaNacimiento
    if (datos.salario !== undefined) {
      datos.salario = Types.Decimal128.fromString(String(datos.salario));
    }

    if (datos.fechaNacimiento !== undefined) {
      datos.fechaNacimiento = new Date(datos.fechaNacimiento);
    }

    // Actualiza el trabajador cuyo documento coincida con req.params.id usando $set
    const trabajadorActualizado = await Trabajador.updateOne(
      { documento: req.params.id },
      { $set: datos }
    );
    // Responde con el resultado de la operación
    res.status(200).json(trabajadorActualizado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Elimina el trabajador cuyo documento coincida con req.params.id
// Responde con el resultado de la operación
exports.deleteTrabajador = async (req, res) => {
  try {
    const trabajadorEliminado = await Trabajador.deleteOne({ documento: req.params.id });
    res.status(200).json(trabajadorEliminado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};