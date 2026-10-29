const mongoose = require('mongoose');
const { Schema } = mongoose;

const clienteSchema = new Schema(
  {
    nombre: { type: String, required: true },
    documento: { type: String, required: true, unique: true, trim: true },
    celular: { type: String, required: true },
    direccion: { type: String, required: true },
    // "edad" viene a veces como string y a veces como int en los datos originales
    edad: { type: Number, required: true },
    fechaNacimiento: { type: Date, required: true },
    correo: {
      type: String,
      default: '',
      lowercase: true,
      trim: true,
      match: [/^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'El correo no es válido'],
    },
    activo: { type: Boolean, default: true },
    password: { type: String, required: true, select: false },
  },
  { collection: 'clientes' }
);

clienteSchema.index({ activo: 1, nombre: 1 });
clienteSchema.index({ correo: 1 });

clienteSchema.methods.toJSON = function () {
  const cliente = this.toObject();
  delete cliente.password;
  return cliente;
};

module.exports = mongoose.model('Cliente', clienteSchema);