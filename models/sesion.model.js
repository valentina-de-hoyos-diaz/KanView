const mongoose = require('mongoose');
const { Schema } = mongoose;

const sesionSchema = new Schema(
  {
    sessionIdHash: { type: String, required: true, unique: true },
    usuario: {
      type: Schema.Types.ObjectId,
      ref: 'Usuario',
      required: true,
      index: true,
    },
    expira: { type: Date, required: true, index: { expires: 0 } },
    activa: { type: Boolean, default: true },
    ip: { type: String },
    userAgent: { type: String },
  },
  { collection: 'sesiones', timestamps: true }
);

sesionSchema.methods.toJSON = function () {
  const sesion = this.toObject();
  delete sesion.sessionIdHash;
  return sesion;
};

module.exports = mongoose.model('Sesion', sesionSchema);
