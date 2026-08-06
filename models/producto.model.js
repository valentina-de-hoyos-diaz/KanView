const mongoose = require('mongoose');
const { Schema } = mongoose;

const productoSchema = new Schema(
  {
    nombre: { type: String, required: true },
    codigoProducto: { type: String, required: true },
    descripcion: { type: String, required: true },
    categoria: { type: String, enum: ['Oficina', 'Industrial', 'Hogar', 'Automoviles'], required: [true, "Digita una opción válida"] },
    precio: { type: Schema.Types.Decimal128, required: true },
    stock: { type: Number, required: true },
  },
  { collection: 'producto' }
);

module.exports = mongoose.model('Producto', productoSchema);