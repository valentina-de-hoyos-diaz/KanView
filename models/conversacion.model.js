const mongoose = require('mongoose');
const { Schema } = mongoose;

const participanteSchema = new Schema(
  {
    id: { type: Schema.Types.ObjectId, required: true },
    tipo: { type: String, enum: ['Usuario', 'Cliente'], required: true },
  },
  { _id: false }
);

const conversacionSchema = new Schema(
  {
    clave: { type: String, required: true, unique: true, index: true },
    participantes: {
      type: [participanteSchema],
      validate: {
        validator: (valor) => valor.length === 2,
        message: 'Una conversación debe tener exactamente dos participantes',
      },
      required: true,
    },
    ultimaActividad: { type: Date, default: Date.now, index: true },
    activa: { type: Boolean, default: true, index: true },
  },
  { collection: 'conversaciones', timestamps: true }
);

conversacionSchema.index({ 'participantes.id': 1, ultimaActividad: -1 });
conversacionSchema.index({
  'participantes.id': 1,
  'participantes.tipo': 1,
  ultimaActividad: -1,
});

module.exports = mongoose.model('Conversacion', conversacionSchema);
