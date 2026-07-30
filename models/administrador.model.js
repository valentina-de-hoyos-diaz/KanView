const mongoose = require('mongoose');
const { Schema } = mongoose;

const administradorSchema = new Schema(
  {
    nombre: { type: String, required: true },
    documento: { type: String, required: true },
    celular: { type: String, required: true },
  },
  { collection: 'administradores' }
);

module.exports = mongoose.model('Administrador', administradorSchema);