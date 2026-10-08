const mongoose = require('mongoose');
const { Schema } = mongoose;

const ROLES = ['admin', 'usuario'];

const usuarioSchema = new Schema(
  {
    nombre: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'El email no es válido'],
    },
    password: { type: String, required: true, select: false },
    rol: { type: String, enum: ROLES, default: 'usuario' },
    activo: { type: Boolean, default: true },
  },
  { collection: 'usuarios', timestamps: true }
);

usuarioSchema.methods.toJSON = function () {
  const usuario = this.toObject();
  delete usuario.password;
  return usuario;
};

const Usuario = mongoose.model('Usuario', usuarioSchema);

module.exports = Usuario;
module.exports.ROLES = ROLES;
