require('dotenv').config()

const mongoose = require('mongoose');

const URI = process.env.MONGODB_URI;

if (URI) {
  mongoose.connect(URI).catch((error) => {
    console.error('Error al conectar con MongoDB:', error.message);
  });
} else {
  console.warn('MONGODB_URI no está configurada; la aplicación inicia sin conexión a la base de datos.');
}

module.exports = mongoose;
