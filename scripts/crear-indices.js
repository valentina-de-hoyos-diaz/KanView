const mongoose = require('mongoose');

const config = require('../config/env');

const modelos = [
  require('../models/cliente.model'),
  require('../models/trabajador.model'),
  require('../models/producto.model'),
  require('../models/pedido.model'),
  require('../models/tareaPedido.model'),
  require('../models/actividad.model'),
  require('../models/inventario.model'),
  require('../models/calendario.model'),
  require('../models/finanza.model'),
  require('../models/usuario.model'),
  require('../models/sesion.model'),
  require('../models/auditoria.model'),
  require('../models/conversacion.model'),
  require('../models/mensaje.model'),
  require('../models/eventoPedido.model'),
];

(async () => {
  await mongoose.connect(config.mongodbUri, config.mongodbDb ? { dbName: config.mongodbDb } : {});

  for (const modelo of modelos) {
    await modelo.createIndexes();
    console.log(`Índices verificados: ${modelo.modelName}`);
  }

  console.log('Indexación de MongoDB completada.');
  await mongoose.disconnect();
})().catch(async (error) => {
  console.error('No se pudieron crear los índices:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
