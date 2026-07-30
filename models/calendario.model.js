const mongoose = require('mongoose');
const { Schema } = mongoose;

const calendarioSchema = new Schema(
  {
    Anio: { type: Number, required: true },
    Mes: { type: Number, required: true },
    Dia: { type: Number, required: true },
    Fecha: { type: String, required: true },
    NombreDia: { type: String, required: true },
    NombreMes: { type: String, required: true },
    Idpedidos: { type: Schema.Types.ObjectId, ref: 'Pedido', required: true },
  },
  { collection: 'calendarios' }
);

module.exports = mongoose.model('Calendario', calendarioSchema);