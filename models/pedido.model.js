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
    codigo: { type: String, required: true },
    descripcion: { type: String, required: true },
    cantidad: { type: Number, required: true },
    precio: { type: Number, required: true },
    fecha_registro: { type: Date, required: true },
  },
  { _id: false }
);

const pedidoSchema = new Schema(
  {
    codigo_pedido: { type: String, required: true },
    descripcion: { type: String, required: true },
    // "cliente" puede ser un ObjectId (referencia) o un objeto embebido completo
    cliente: { type: Schema.Types.Mixed, required: true },
    // El export original relaciona empleadoId con "clientes", pero por el nombre
    // probablemente corresponda a Trabajador. Ajusta el ref si aplica.
    empleadoId: { type: Schema.Types.ObjectId, ref: 'Trabajador', required: true },
    estado_pedido: { type: [String], required: true },
    evidencia: { type: String, required: true },
    fecha_creacion: { type: String, required: true },
    hora_creacion: { type: String, required: true },
    factura: { type: facturaSchema, required: true },
    producto: { type: productoEmbebidoSchema, required: true },
  },
  { collection: 'pedidos' }
);

module.exports = mongoose.model('Pedido', pedidoSchema);