// Importación de mongoose y del modelo Inventario
const mongoose = require('mongoose');
const Inventario = require('../models/inventario.model');

// Extrae ObjectId para el campo idProducto
const { Types } = mongoose;

// Obtiene todos los registros de inventario y los retorna en formato JSON
exports.getInventarios = async (req, res) => {
  try {
    const inventarios = await Inventario.find();
    res.status(200).json(inventarios);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Busca un inventario por idProducto (recibido como req.params.id desde el router)
// Si no existe, responde con 404
exports.getInventarioById = async (req, res) => {
  try {
    const inventario = await Inventario.findOne({ idProducto: Types.ObjectId(req.params.id) });
    if (!inventario) {
      return res.status(404).json({ error: 'Inventario no encontrado' });
    }
    res.status(200).json(inventario);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Registra un nuevo registro de inventario
exports.createInventario = async (req, res) => {
  try {
    // Arma el objeto con los campos del modelo a partir del body
    let nuevoInventario = {
      idProducto: req.body.idProducto,
      fechaIngreso: req.body.fechaIngreso,
      ultimaActualizacion: req.body.ultimaActualizacion,
    };

    // Convierte idProducto a ObjectId (tipo del modelo)
    if (nuevoInventario.idProducto !== undefined) {
      nuevoInventario.idProducto = Types.ObjectId(nuevoInventario.idProducto);
    }

    // Convierte fechaIngreso a tipo Date
    if (nuevoInventario.fechaIngreso !== undefined) {
      nuevoInventario.fechaIngreso = new Date(nuevoInventario.fechaIngreso);
    }

    // Convierte ultimaActualizacion a tipo Date
    if (nuevoInventario.ultimaActualizacion !== undefined) {
      nuevoInventario.ultimaActualizacion = new Date(nuevoInventario.ultimaActualizacion);
    }

    // Crea el documento en la base y responde 201
    const inventarioGuardado = await Inventario.create(nuevoInventario);
    res.status(201).json(inventarioGuardado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Actualiza un inventario existente
exports.updateInventario = async (req, res) => {
  try {
    // Arma el objeto con los campos a actualizar desde el body
    let datos = {
      idProducto: req.body.idProducto,
      fechaIngreso: req.body.fechaIngreso,
      ultimaActualizacion: req.body.ultimaActualizacion,
    };

    // Aplica las mismas conversiones de idProducto y fechas
    if (datos.idProducto !== undefined) {
      datos.idProducto = Types.ObjectId(datos.idProducto);
    }

    if (datos.fechaIngreso !== undefined) {
      datos.fechaIngreso = new Date(datos.fechaIngreso);
    }

    if (datos.ultimaActualizacion !== undefined) {
      datos.ultimaActualizacion = new Date(datos.ultimaActualizacion);
    }

    // Actualiza el inventario cuyo idProducto coincida con req.params.id usando $set
    const inventarioActualizado = await Inventario.updateOne(
      { idProducto: Types.ObjectId(req.params.id) },
      { $set: datos }
    );
    // Responde con el resultado de la operación
    res.status(200).json(inventarioActualizado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Elimina el inventario cuyo idProducto coincida con req.params.id
// Responde con el resultado de la operación
exports.deleteInventario = async (req, res) => {
  try {
    const inventarioEliminado = await Inventario.deleteOne({ idProducto: Types.ObjectId(req.params.id) });
    res.status(200).json(inventarioEliminado);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};