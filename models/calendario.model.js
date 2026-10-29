const mongoose = require('mongoose');
const { Schema } = mongoose;

const calendarioSchema = new Schema(
  {
    titulo: { type: String, required: true, trim: true, maxlength: 255 },
    descripcion: { type: String, default: '', trim: true, maxlength: 2000 },
    inicio: { type: Date, required: true, index: true },
    fin: { type: Date, required: true },
    recordatorioMinutos: { type: Number, default: 0, min: 0 },
    recordatorioEnviado: { type: Boolean, default: false },
    pedido: { type: Schema.Types.ObjectId, ref: 'Pedido', default: null },
    usuario: { type: Schema.Types.ObjectId, ref: 'Usuario', default: null },
    activo: { type: Boolean, default: true, index: true },
    // Campos heredados del modelo anterior; se conservan para no perder datos.
    año: { type: Number },
    mes: { type: Number },
    dia: { type: Number },
    fecha: { type: Date },
    nombreDia: { type: String },
    nombreMes: { type: String },
    idPedidos: { type: Schema.Types.ObjectId, ref: 'Pedido' },
  },
  { collection: 'calendarios', timestamps: true }
);

calendarioSchema.index({ inicio: 1, activo: 1 });
calendarioSchema.index({ pedido: 1, inicio: 1 });
calendarioSchema.index({ recordatorioEnviado: 1, inicio: 1 });

module.exports = mongoose.model('Calendario', calendarioSchema);
