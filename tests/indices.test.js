process.env.MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/kanview_test';
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'secreto-de-prueba-con-longitud-suficiente-1234567890';
process.env.API_KEY = process.env.API_KEY || 'api-key-de-prueba';

const test = require('node:test');
const assert = require('node:assert/strict');

const Pedido = require('../models/pedido.model');
const Producto = require('../models/producto.model');
const TareaPedido = require('../models/tareaPedido.model');
const Actividad = require('../models/actividad.model');
const Inventario = require('../models/inventario.model');
const Cliente = require('../models/cliente.model');
const Trabajador = require('../models/trabajador.model');
const Usuario = require('../models/usuario.model');
const Finanza = require('../models/finanza.model');
const Sesion = require('../models/sesion.model');
const Mensaje = require('../models/mensaje.model');
const Conversacion = require('../models/conversacion.model');

const tieneIndice = (modelo, campos, opciones = {}) =>
  modelo.schema.indexes().some(([definicion, configuracion]) => {
    if (JSON.stringify(definicion) !== JSON.stringify(campos)) return false;
    return Object.entries(opciones).every(([clave, valor]) => configuracion[clave] === valor);
  });

test('los modelos tienen índices para filtros, orden y búsquedas principales', () => {
  assert.ok(tieneIndice(Pedido, { codigoPedido: 1 }, { unique: true }));
  assert.ok(tieneIndice(Pedido, { activo: 1, estadoPedido: 1, fechaCreacion: -1 }));
  assert.ok(tieneIndice(Pedido, { cliente: 1, fechaCreacion: -1 }));
  assert.ok(tieneIndice(Pedido, { empleadoId: 1, fechaCreacion: -1 }));

  assert.ok(tieneIndice(Producto, { codigoProducto: 1 }, { unique: true }));
  assert.ok(tieneIndice(Producto, { activo: 1, categoria: 1, nombre: 1 }));

  assert.ok(tieneIndice(TareaPedido, { idPedido: 1, activo: 1, createdAt: -1 }));
  assert.ok(tieneIndice(TareaPedido, { empleadoId: 1, estado: 1, activo: 1 }));
  assert.ok(tieneIndice(Actividad, { idTarea: 1, estado: 1, activo: 1 }));
  assert.ok(tieneIndice(Inventario, { idProducto: 1 }));

  assert.ok(tieneIndice(Cliente, { activo: 1, nombre: 1 }));
  assert.ok(tieneIndice(Trabajador, { documento: 1 }));
  assert.ok(tieneIndice(Usuario, { email: 1 }, { unique: true }));
  assert.ok(tieneIndice(Sesion, { usuario: 1, activa: 1, expira: 1 }));
  assert.ok(tieneIndice(Finanza, { pedido: 1, fecha: -1 }));

  assert.ok(tieneIndice(Conversacion, { 'participantes.id': 1, ultimaActividad: -1 }));
  assert.ok(tieneIndice(Mensaje, { conversacion: 1, leido: 1, autorId: 1 }));
});
