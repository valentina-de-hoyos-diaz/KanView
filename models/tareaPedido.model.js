const mongoose = require('mongoose');
const { Schema } = mongoose;

const ESTADOS_TRABAJO = ['Pendiente', 'En proceso', 'En progreso', 'Completado', 'Cancelado'];

const tareaPedidoSchema = new Schema(
  {
    nombre: { type: String, required: true, trim: true, maxlength: 100 },
    descripcion: { type: String, required: true, trim: true, maxlength: 1000 },
    estado: { type: String, enum: ESTADOS_TRABAJO, default: 'Pendiente' },
    fechaInicio: { type: Date, required: true },
    fechaFin: { type: Date, required: true },
    idPedido: { type: Schema.Types.ObjectId, ref: 'Pedido', required: true, index: true },
    empleadoId: { type: Schema.Types.ObjectId, ref: 'Trabajador', default: null },
    confirmadoPor: { type: Schema.Types.ObjectId, ref: 'Usuario', default: null },
    fechaConfirmacion: { type: Date, default: null },
    activo: { type: Boolean, default: true, index: true },
  },
  { collection: 'tareas_pedido', timestamps: true }
);

tareaPedidoSchema.index({ idPedido: 1, activo: 1, createdAt: -1 });
tareaPedidoSchema.index({ empleadoId: 1, estado: 1, activo: 1 });
tareaPedidoSchema.index({ estado: 1, fechaInicio: 1 });

const TareaPedido = mongoose.model('TareaPedido', tareaPedidoSchema);

module.exports = TareaPedido;
module.exports.ESTADOS_TRABAJO = ESTADOS_TRABAJO;
