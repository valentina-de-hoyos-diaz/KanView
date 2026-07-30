const mongoose = require('mongoose');
const { Schema } = mongoose;

const tareaPedidoSchema = new Schema(
  {
    nombre: { type: String, required: true },
    descripcion: { type: String, required: true },
    estado: { type: [String], required: true },
    fecha_inicio: { type: Date, required: true },
    fecha_fin: { type: Date, required: true },
    idPedido: { type: Schema.Types.ObjectId, ref: 'Pedido', required: true },
  },
  { collection: 'tareas_pedido' }
);

module.exports = mongoose.model('TareaPedido', tareaPedidoSchema);