const mongoose = require('mongoose');
const { Schema } = mongoose;

const productoSchema = new Schema(
  {
    nombre: { type: String, required: true },
    codigoProducto: { type: String, required: true, unique: true, trim: true },
    descripcion: { type: String, required: true },
    categoria: {
      type: String,
      enum: [
        'tela',
        'espuma',
        'madera',
        'herraje',
        'hilo',
        'otro',
        'Oficina',
        'Industrial',
        'Hogar',
        'Automoviles',
      ],
      required: [true, 'Digita una opción válida'],
    },
    precio: { type: Schema.Types.Decimal128, required: true },
    stock: { type: Number, required: true },
    activo: { type: Boolean, default: true, index: true },
  },
  { collection: 'producto' }
);

productoSchema.index({ activo: 1, categoria: 1, nombre: 1 });
productoSchema.index({ nombre: 1 });

module.exports = mongoose.model('Producto', productoSchema);