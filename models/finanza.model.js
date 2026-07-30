const mongoose = require('mongoose');
const { Schema } = mongoose;

const finanzaSchema = new Schema(
  {
    IdAdministrador: { type: Schema.Types.ObjectId, ref: 'Administrador', required: true },
    FuentesIngresos: { type: Schema.Types.Decimal128, required: true },
    Gastos: { type: Schema.Types.Decimal128, required: true },
    ProductosVendidos: { type: Number, required: true },
  },
  { collection: 'finanzas' }
);

module.exports = mongoose.model('Finanza', finanzaSchema);