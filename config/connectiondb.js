const mongoose = require('mongoose');
const { mongodbUri, mongodbDb } = require('./env');

const opciones = mongodbDb ? { dbName: mongodbDb } : {};

mongoose
  .connect(mongodbUri, opciones)
  .then(() => console.log('Conectado a MongoDB'))
  .catch((error) => {
    console.error('Error al conectar a MongoDB:', error.message);
    process.exit(1);
  });



module.exports = mongoose;
