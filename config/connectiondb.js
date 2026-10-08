const mongoose = require('mongoose');
const { mongodbUri } = require('./env');

mongoose
  .connect(mongodbUri)
  .then(() => console.log('Conectado a MongoDB'))
  .catch((error) => {
    console.error('Error al conectar a MongoDB:', error.message);
    process.exit(1);
  });

module.exports = mongoose;
