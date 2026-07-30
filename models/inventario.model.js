const mongoose = require('mongoose');
const { Schema } = mongoose;

const inventarioSchema = new Schema(
  {
    idProducto: { type: Schema.Types.ObjectId, ref: 'Producto', required: true },
    fechaIngreso: { type: Date, required: true },
    ultimaActualizacion: { type: Date, required: true },
  },
  { collection: 'inventario' }
);

module.exports = mongoose.model('Inventario', inventarioSchema);