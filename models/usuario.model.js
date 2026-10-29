const mongoose = require('mongoose');
const { Schema } = mongoose;

const ROLES = ['admin', 'secretaria', 'trabajador', 'usuario'];
const ROLES_STAFF = ['admin', 'secretaria', 'trabajador', 'usuario'];
const ROLES_GESTION = ['admin', 'secretaria'];

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
    rol: { type: String, enum: ROLES, default: 'trabajador' },
    activo: { type: Boolean, default: true },
    trabajadorId: {
      type: Schema.Types.ObjectId,
      ref: 'Trabajador',
      default: undefined,
    },
    debeCambiarPassword: { type: Boolean, default: false },
    ultimoAcceso: { type: Date, default: null },
  },
  { collection: 'usuarios', timestamps: true }
);

usuarioSchema.index({ rol: 1, activo: 1 });
usuarioSchema.index({ nombre: 1 });
usuarioSchema.index(
  { trabajadorId: 1 },
  {
    unique: true,
    partialFilterExpression: { trabajadorId: { $type: 'objectId' } },
    name: 'usuario_trabajador_unico',
  }
);

usuarioSchema.methods.toJSON = function () {
  const usuario = this.toObject();
  delete usuario.password;
  return usuario;
};

const Usuario = mongoose.model('Usuario', usuarioSchema);

module.exports = Usuario;
module.exports.ROLES = ROLES;
module.exports.ROLES_STAFF = ROLES_STAFF;
module.exports.ROLES_GESTION = ROLES_GESTION;
