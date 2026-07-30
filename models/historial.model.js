const mongoose = require('mongoose');
const { Schema } = mongoose;

const direccionSchema = new Schema(
  {
    calle: { type: String, required: true },
    ciudad: { type: String, required: true },
  },
  { _id: false }
);

const trabajadorEmbebidoSchema = new Schema(
  {
    nombre: { type: String, required: true },
    documento: { type: String, required: true },
    celular: { type: String, required: true },
    cargo: { type: String, required: true },
    direccion: { type: direccionSchema, required: true },
  },
  { _id: false }
);

const clienteEmbebidoSchema = new Schema(
  {
    nombre: { type: String, required: true },
    cedula: { type: String, required: true },
    fechaNacimiento: { type: Date, required: true },
  },
  { _id: false }
);

const historialSchema = new Schema(
  {
    pedidosId: { type: Schema.Types.ObjectId, ref: 'Pedido', required: true },
    // fechaCreacion viene a veces como Date y a veces como string
    fechaCreacion: { type: Schema.Types.Mixed, required: true },
    cliente: { type: clienteEmbebidoSchema, required: true },
    trabajador: { type: trabajadorEmbebidoSchema, required: true },
  },
  { collection: 'historiales' }
);

module.exports = mongoose.model('Historial', historialSchema);