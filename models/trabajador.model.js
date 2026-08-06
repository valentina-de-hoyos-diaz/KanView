const mongoose = require('mongoose');
const { Schema } = mongoose;

const trabajadorSchema = new Schema(
  {
    nombre: { type: String, required: true },
    documento: { type: String, required: true },
    celular: { type: String, required: true },
    direccion: { type: String, required: true },
    edad: { type: Number, required: true },
    fechaNacimiento: { type: Date, required: true },
    cargo: { type: String, required: true },
    RH: { type: String, required: true },
    salario: { type: Schema.Types.Decimal128, required: true },
    tareasRealizadas: { type: Number, required: true },
  },
  { collection: 'trabajador' }
);

module.exports = mongoose.model('Trabajador', trabajadorSchema);