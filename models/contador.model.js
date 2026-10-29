const mongoose = require('mongoose');
const { Schema } = mongoose;

const contadorSchema = new Schema(
  {
    _id: { type: String, required: true },
    secuencia: { type: Number, required: true, default: 0 },
  },
  { collection: 'contadores', versionKey: false }
);

module.exports = mongoose.model('Contador', contadorSchema);
