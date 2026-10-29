const Contador = require('../models/contador.model');

const LONGITUD_POR_DEFECTO = 4;

const formatearCodigo = (prefijo, numero, longitud = LONGITUD_POR_DEFECTO) =>
  `${prefijo}-${String(numero).padStart(longitud, '0')}`;

const siguienteCodigo = async (clave, prefijo, longitud = LONGITUD_POR_DEFECTO) => {
  const contador = await Contador.findByIdAndUpdate(
    clave,
    { $inc: { secuencia: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  return formatearCodigo(prefijo, contador.secuencia, longitud);
};

module.exports = { formatearCodigo, siguienteCodigo };
