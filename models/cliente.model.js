const mongoose = require('mongoose');
const { Schema } = mongoose;

const clienteSchema = new Schema(
  {
    nombre: { type: String, required: true },
    documento: { type: String, required: true },
    celular: { type: String, required: true },
    direccion: { type: String, required: true },
    // "edad" viene a veces como string y a veces como int en los datos originales
    edad: { type: Number, required: true },
    fechaNacimiento: { type: Date, required: true },
  },
  { collection: 'clientes' }
);

module.exports = mongoose.model('Cliente', clienteSchema);