const mongoose = require('mongoose');
const { Schema } = mongoose;

const ubicacionSchema = new Schema(
  {
    barrio: { type: String, required: true },
    ciudad: { type: String, required: true },
    direccion: { type: String, required: true },
    pais: { type: String, required: true },
  },
  { _id: false }
);

const clienteEmbebidoSchema = new Schema(
  {
    nombre: { type: String, required: true },
    telefono: { type: String, required: true },
    edad: { type: Number, required: true },
    fecha_nacimiento: { type: String, required: true },
    fecha_creacion: { type: Date, required: true },
    ubicacion: { type: ubicacionSchema, required: true },
  },
  { _id: false }
);

const facturaSchema = new Schema(
  {
    nombre_cliente: { type: String, required: true },
    barrio: { type: String, required: true },
    ciudad: { type: String, required: true },
    direccion: { type: String, required: true },
    pais: { type: String, required: true },
    iva: { type: Number, required: true },
    total: { type: Number, required: true },
    fecha_creacion: { type: Date, required: true },
  },
  { _id: false }
);

const productoEmbebidoSchema = new Schema(
  {
    nombre: { type: String, required: true },
    codigo: { type: String },
    descripcion: { type: String },
    cantidad: { type: Number, default: 1 },
    precio: { type: Number, default: 0 },
    fecha_registro: { type: Date, default: Date.now },
  },
  { _id: false }
);

const pedidoSchema = new Schema(
  {
    codigoPedido: { type: String, required: true },
    descripcion: { type: String, required: true },
    // "cliente" es el cliente dueño del pedido (lo crea él mismo o un admin a su nombre)
    cliente: { type: Schema.Types.ObjectId, ref: 'Cliente', required: true },
    // "empleadoId" se asigna después; un cliente no sabe qué trabajador lo atiende
    empleadoId: { type: Schema.Types.ObjectId, ref: 'Trabajador' },
    estadoPedido: { type: String, enum: ['En proceso', 'Completado', 'Pendiente', 'Cancelado'], required: true },
    evidencia: { type: String },
    fechaCreacion: { type: Date, required: true },
    horaCreacion: { type: String, required: true },
    factura: { type: facturaSchema },
    producto: { type: productoEmbebidoSchema },
    usuarioCreador: {
      type: Schema.Types.ObjectId,
      refPath: 'tipoUsuarioCreador',
      required: true,
    },
    tipoUsuarioCreador: {
      type: String,
      enum: ['Usuario', 'Cliente'],
      default: 'Usuario',
    },
  },
  { collection: 'pedidos' }
);

module.exports = mongoose.model('Pedido', pedidoSchema);