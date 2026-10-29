const Auditoria = require('../models/auditoria.model');

const datosSesion = (req) => {
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

const registrarAuditoria = async (
  req,
  { accion, entidad = '', entidadId = '', detalle = '' }
) => {
  const { usuario, tipoUsuario } = datosSesion(req);

  try {
    await Auditoria.create({
      usuario,
      tipoUsuario,
      accion,
      entidad,
      entidadId: entidadId ? String(entidadId) : '',
      detalle,
      ip: req ? req.ip : '',
      userAgent: req ? req.get('user-agent') : '',
    });
  } catch (error) {
    console.error(`[auditoria] No se pudo registrar "${accion}":`, error.message);
  }
};

module.exports = { registrarAuditoria };
