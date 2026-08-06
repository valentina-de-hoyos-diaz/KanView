const mongoose = require('mongoose');
const { Schema } = mongoose;

const catalogoSchema = new Schema(
  {
    nombre: { type: String, required: true },
    categorias: { type: String, enum: ['Oficina', 'Industrial', 'Hogar', 'Automoviles'], required: [true, "Digita una opción válida"] },
    // idinventario/idproducto también aparecían relacionados con "pedidos"
    // en el export original (relación inferida ambigua). Ajusta si aplica.
    idInventario: { type: Schema.Types.ObjectId, ref: 'Inventario', required: true },
    idProducto: { type: Schema.Types.ObjectId, ref: 'Producto', required: true },
  },
  { collection: 'catalogos' }
);

module.exports = mongoose.model('Catalogo', catalogoSchema);