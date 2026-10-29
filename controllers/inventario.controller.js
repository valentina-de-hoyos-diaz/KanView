// Importación de mongoose y del modelo Inventario
const mongoose = require('mongoose');
const Inventario = require('../models/inventario.model');
const Producto = require('../models/producto.model');
const {
  consultarPaginado,
  responderPaginado,
} = require('../services/paginacion.service');

// Extrae ObjectId para el campo idProducto
const { Types } = mongoose;
const UMBRAL_STOCK_BAJO = 5;

// Obtiene todos los registros de inventario y los retorna en formato JSON
exports.getInventarios = async (req, res) => {
  try {
    const { items, paginacion } = await consultarPaginado(Inventario, {}, {
      query: req.query,
      sort: { fechaIngreso: -1 },
      populate: [{ path: 'idProducto', select: 'nombre codigoProducto stock categoria' }],
    });

    return responderPaginado(res, 'Inventarios obtenidos correctamente', items, paginacion);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getResumenInventario = async (req, res) => {
  try {
    const [totales, porCategoria] = await Promise.all([
      Producto.aggregate([
        { $match: { activo: { $ne: false } } },
        {
          $group: {
            _id: null,
            totalProductos: { $sum: 1 },
            unidades: { $sum: '$stock' },
            agotados: {
              $sum: { $cond: [{ $lte: ['$stock', 0] }, 1, 0] },
            },
            stockBajo: {
              $sum: {
                $cond: [
                  { $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', UMBRAL_STOCK_BAJO] }] },
                  1,
                  0,
                ],
              },
            },
            valorInventario: {
              $sum: { $multiply: [{ $toDouble: '$precio' }, '$stock'] },
            },
          },
        },
      ]),
      Producto.aggregate([
        { $match: { activo: { $ne: false } } },
        {
          $group: {
            _id: '$categoria',
            productos: { $sum: 1 },
            unidades: { $sum: '$stock' },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const { _id, ...datos } = totales[0] || {
      totalProductos: 0,
      unidades: 0,
      agotados: 0,
      stockBajo: 0,
      valorInventario: 0,
    };

    return res.status(200).json({
      status: 200,
      message: 'Resumen de inventario obtenido correctamente',
      data: {
        ...datos,
        umbralStockBajo: UMBRAL_STOCK_BAJO,
        porCategoria: porCategoria.map((categoria) => ({
          categoria: categoria._id || 'sin-categoria',
          productos: categoria.productos,
          unidades: categoria.unidades,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 500,
      message: 'Error al obtener el resumen de inventario',
      data: null,
    });
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