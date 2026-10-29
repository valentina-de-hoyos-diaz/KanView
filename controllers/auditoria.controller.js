const mongoose = require('mongoose');
const Auditoria = require('../models/auditoria.model');

const escaparRegex = (texto) => String(texto).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const listarAuditoria = async (req, res) => {
  try {
    const pagina = Math.max(Number(req.query.pagina) || 1, 1);
    const limite = Math.min(Math.max(Number(req.query.limite) || 25, 1), 100);
    const filtro = {};

    if (req.query.accion) {
      filtro.accion = new RegExp(escaparRegex(req.query.accion), 'i');
    }

    if (req.query.entidad) {
      filtro.entidad = new RegExp(escaparRegex(req.query.entidad), 'i');
    }

    if (req.query.usuario && mongoose.isValidObjectId(req.query.usuario)) {
      filtro.usuario = req.query.usuario;
    }

    if (req.query.desde || req.query.hasta) {
      filtro.createdAt = {};
      if (req.query.desde) filtro.createdAt.$gte = new Date(req.query.desde);
      if (req.query.hasta) filtro.createdAt.$lte = new Date(req.query.hasta);
    }

    if (req.query.texto) {
      filtro.$or = [
        { detalle: new RegExp(escaparRegex(req.query.texto), 'i') },
        { entidadId: new RegExp(escaparRegex(req.query.texto), 'i') },
      ];
    }

    const [registros, total] = await Promise.all([
      Auditoria.find(filtro)
        .populate('usuario', 'nombre email rol')
        .sort({ createdAt: -1 })
        .skip((pagina - 1) * limite)
        .limit(limite),
      Auditoria.countDocuments(filtro),
    ]);

    return res.status(200).json({
      status: 200,
      message: 'Auditoría obtenida correctamente',
      data: {
        registros,
        total,
        pagina,
        limite,
        paginas: Math.ceil(total / limite),
      },
      paginacion: {
        pagina,
        limite,
        total,
        paginas: Math.ceil(total / limite),
        tieneSiguiente: pagina * limite < total,
        tieneAnterior: pagina > 1,
      },
    });
  } catch (error) {
    console.error('[auditoria] Error al listar:', error.message);
    return res.status(500).json({
      status: 500,
      message: 'Error al obtener la auditoría',
      data: null,
    });
  }
};

module.exports = { listarAuditoria };
