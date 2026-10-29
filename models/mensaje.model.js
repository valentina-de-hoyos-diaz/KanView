const mongoose = require('mongoose');
const { Schema } = mongoose;

const mensajeSchema = new Schema(
  {
    conversacion: {
      type: Schema.Types.ObjectId,
      ref: 'Conversacion',
      required: true,
      index: true,
    },
    autorId: { type: Schema.Types.ObjectId, required: true },
    autorTipo: { type: String, enum: ['Usuario', 'Cliente'], required: true },
    autorNombre: { type: String, required: true, maxlength: 150 },
    texto: { type: String, required: true, trim: true, maxlength: 2000 },
    leido: { type: Boolean, default: false, index: true },
  },
  { collection: 'mensajes', timestamps: true }
);

mensajeSchema.index({ conversacion: 1, createdAt: 1 });
mensajeSchema.index({ conversacion: 1, leido: 1, autorId: 1 });

module.exports = mongoose.model('Mensaje', mensajeSchema);
