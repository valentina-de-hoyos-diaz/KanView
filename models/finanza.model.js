const mongoose = require('mongoose');
const { Schema } = mongoose;

const FUENTES_INGRESO = ['directa', 'mayorista', 'personalizado', 'otro'];

const finanzaSchema = new Schema(
  {
    fecha: { type: Date, default: Date.now, index: true },
    pedido: { type: Schema.Types.ObjectId, ref: 'Pedido', default: null, index: true },
    idAdministrador: { type: Schema.Types.ObjectId, ref: 'Administrador', default: null },
    usuario: { type: Schema.Types.ObjectId, ref: 'Usuario', default: null },
    fuenteIngreso: { type: String, enum: FUENTES_INGRESO, default: 'directa', index: true },
    fuentesIngresos: { type: Schema.Types.Decimal128, required: true },
    gastos: { type: Schema.Types.Decimal128, required: true },
    activo: { type: Boolean, default: true, index: true },
  },
  { collection: 'finanzas', timestamps: true }
);

finanzaSchema.index({ fecha: -1, activo: 1 });
finanzaSchema.index({ activo: 1, fecha: -1 });
finanzaSchema.index({ fuenteIngreso: 1, fecha: -1 });
finanzaSchema.index({ pedido: 1, fecha: -1 });
finanzaSchema.index({ activo: 1, pedido: 1 });

const Finanza = mongoose.model('Finanza', finanzaSchema);

module.exports = Finanza;
module.exports.FUENTES_INGRESO = FUENTES_INGRESO;
