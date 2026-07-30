const mongoose = require('mongoose');
const { Schema } = mongoose;

const productoSchema = new Schema(
  {
    Nombre: { type: String, required: true },
    CodigoProducto: { type: String, required: true },
    Descripcion: { type: String, required: true },
    Categoria: { type: String, required: true },
    Precio: { type: Number, required: true },
    Stock: { type: Number, required: true },
  },
  { collection: 'producto' }
);

module.exports = mongoose.model('Producto', productoSchema);