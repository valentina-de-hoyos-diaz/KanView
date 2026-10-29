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

inventarioSchema.index({ idProducto: 1 });
inventarioSchema.index({ fechaIngreso: -1 });

module.exports = mongoose.model('Inventario', inventarioSchema);