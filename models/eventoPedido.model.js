const mongoose = require('mongoose');
const { Schema } = mongoose;

const eventoPedidoSchema = new Schema(
  {
    pedido: {
      type: Schema.Types.ObjectId,
      ref: 'Pedido',
      required: true,
      index: true,
    },
    accion: { type: String, required: true, trim: true, maxlength: 80 },
    detalle: { type: String, default: '', trim: true, maxlength: 2000 },
    usuario: { type: Schema.Types.ObjectId, refPath: 'tipoUsuario', default: null },
    tipoUsuario: {
      type: String,
      enum: ['Usuario', 'Cliente', 'Sistema'],
      default: 'Sistema',
    },
  },
  { collection: 'historial_pedidos', timestamps: true }
);

eventoPedidoSchema.index({ pedido: 1, createdAt: -1 });

module.exports = mongoose.model('EventoPedido', eventoPedidoSchema);
