const mongoose = require('mongoose');
const { Schema } = mongoose;

const catalogoSchema = new Schema(
  {
    nombre: { type: String, required: true },
    categorias: { type: [String], required: true },
    // idinventario/idproducto también aparecían relacionados con "pedidos"
    // en el export original (relación inferida ambigua). Ajusta si aplica.
    idinventario: { type: Schema.Types.ObjectId, ref: 'Inventario', required: true },
    idproducto: { type: Schema.Types.ObjectId, ref: 'Producto', required: true },
  },
  { collection: 'catalogos' }
);

module.exports = mongoose.model('Catalogo', catalogoSchema);