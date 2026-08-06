const mongoose = require('mongoose');
const { Schema } = mongoose;

const calendarioSchema = new Schema(
  {
    año: { type: Number, required: true },
    mes: { type: Number, required: true },
    dia: { type: Number, required: true },
    fecha: { type: Date, required: true },
    nombreDia: { type: String, required: true },
    nombreMes: { type: String, required: true },
    idPedidos: { type: Schema.Types.ObjectId, ref: 'Pedido', required: true },
  },
  { collection: 'calendarios' }
);

module.exports = mongoose.model('Calendario', calendarioSchema);