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
    productoId: { type: Schema.Types.ObjectId, ref: 'Producto' },
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
    codigoPedido: { type: String, required: true, unique: true, index: true },
    descripcion: { type: String, required: true },
    // "cliente" es el cliente dueño del pedido (lo crea él mismo o un admin a su nombre)
    cliente: { type: Schema.Types.ObjectId, ref: 'Cliente', required: true },
    // "empleadoId" se asigna después; un cliente no sabe qué trabajador lo atiende
    empleadoId: { type: Schema.Types.ObjectId, ref: 'Trabajador' },
    estadoPedido: { type: String, enum: ['En proceso', 'Completado', 'Pendiente', 'Cancelado'], required: true },
    estadoAprobacion: {
      type: String,
      enum: ['Pendiente', 'Aprobado', 'Rechazado'],
      default: 'Aprobado',
      index: true,
    },
    motivoRechazo: { type: String, default: '', trim: true, maxlength: 1000 },
    aprobadoPor: { type: Schema.Types.ObjectId, ref: 'Usuario', default: null },
    fechaAprobacion: { type: Date, default: null },
    fechaEntrega: { type: Date, default: null },
    activo: { type: Boolean, default: true, index: true },
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

pedidoSchema.index({ activo: 1, estadoPedido: 1, fechaCreacion: -1 });
pedidoSchema.index({ cliente: 1, fechaCreacion: -1 });
pedidoSchema.index({ empleadoId: 1, fechaCreacion: -1 });
pedidoSchema.index({ estadoAprobacion: 1, activo: 1, fechaCreacion: -1 });
pedidoSchema.index({ fechaEntrega: 1, activo: 1 });

module.exports = mongoose.model('Pedido', pedidoSchema);