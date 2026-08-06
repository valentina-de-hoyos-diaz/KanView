const mongoose = require('mongoose');
const { Schema } = mongoose;

const finanzaSchema = new Schema(
  {
    idAdministrador: { type: Schema.Types.ObjectId, ref: 'Administrador', required: true },
    fuentesIngresos: { type: Schema.Types.Decimal128, required: true },
    gastos: { type: Schema.Types.Decimal128, required: true },
    productosVendidos: { type: Number, required: true },
  },
  { collection: 'finanzas' }
);

module.exports = mongoose.model('Finanza', finanzaSchema);