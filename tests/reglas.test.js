process.env.MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/kanview_test';
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'secreto-de-prueba-con-longitud-suficiente-1234567890';
process.env.API_KEY = process.env.API_KEY || 'api-key-de-prueba';

const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const { formatearCodigo } = require('../services/codigo.service');
const {
  validarFechaEntrega,
  normalizarCantidad,
  calcularAjusteStock,
  ErrorDePedido,
} = require('../services/pedido.service');
const { validarFechasTrabajo, calcularProgreso } = require('../services/trabajo.service');
const {
  claveActor,
  claveConversacion,
  serializarMensaje,
} = require('../services/mensajeria.service');
const {
  requireRoles,
  requireAdmin,
  requireAdminOrSecretaria,
} = require('../middleware/autenticacion.middleware');

const crearRespuesta = () => ({
  codigo: null,
  body: null,
  status(codigo) {
    this.codigo = codigo;
    return this;
  },
  json(cuerpo) {
    this.body = cuerpo;
    return this;
  },
});

test('formatearCodigo genera códigos consecutivos con ceros a la izquierda', () => {
  assert.equal(formatearCodigo('PED', 1), 'PED-0001');
  assert.equal(formatearCodigo('PED', 42), 'PED-0042');
  assert.equal(formatearCodigo('FAC', 12345, 6), 'FAC-012345');
});

test('normalizarCantidad acepta enteros positivos y rechaza valores inválidos', () => {
  assert.equal(normalizarCantidad(3), 3);
  assert.equal(normalizarCantidad('4'), 4);
  assert.equal(normalizarCantidad(undefined), 1);
  assert.throws(() => normalizarCantidad(0), ErrorDePedido);
  assert.throws(() => normalizarCantidad(1.5), ErrorDePedido);
  assert.throws(() => normalizarCantidad(-2), ErrorDePedido);
});

test('validarFechaEntrega rechaza fechas anteriores a la creación', () => {
  const creacion = new Date('2026-05-10T12:00:00.000Z');

  assert.equal(validarFechaEntrega(null, creacion), null);
  assert.ok(validarFechaEntrega('2026-05-10', creacion) instanceof Date);
  assert.ok(validarFechaEntrega('2026-05-11', creacion) instanceof Date);
  assert.throws(
    () => validarFechaEntrega('2026-05-09', creacion),
    /anterior a la fecha de creación/
  );
  assert.throws(() => validarFechaEntrega('no-es-fecha', creacion), /no es válida/);
});

test('calcularAjusteStock calcula reservas y liberaciones al editar un pedido', () => {
  const productoA = new mongoose.Types.ObjectId();
  const productoB = new mongoose.Types.ObjectId();

  assert.deepEqual(
    calcularAjusteStock({
      productoAnteriorId: productoA,
      cantidadAnterior: 2,
      productoNuevoId: productoA,
      cantidadNueva: 5,
    }),
    { reservar: 3, liberar: 0 }
  );

  assert.deepEqual(
    calcularAjusteStock({
      productoAnteriorId: productoA,
      cantidadAnterior: 5,
      productoNuevoId: productoA,
      cantidadNueva: 2,
    }),
    { reservar: 0, liberar: 3 }
  );

  assert.deepEqual(
    calcularAjusteStock({
      productoAnteriorId: productoA,
      cantidadAnterior: 2,
      productoNuevoId: productoB,
      cantidadNueva: 4,
    }),
    { reservar: 4, liberar: 2 }
  );
});

test('validarFechasTrabajo exige el rango del pedido y de la tarea', () => {
  const pedido = {
    fechaCreacion: new Date('2026-05-01T00:00:00.000Z'),
    fechaEntrega: new Date('2026-05-20T00:00:00.000Z'),
  };

  const rango = validarFechasTrabajo(pedido, '2026-05-05', '2026-05-10');
  assert.equal(rango.inicio.toISOString().slice(0, 10), '2026-05-05');
  assert.equal(rango.fin.toISOString().slice(0, 10), '2026-05-10');

  assert.throws(
    () => validarFechasTrabajo(pedido, '2026-04-30', '2026-05-10'),
    /anterior a la fecha de registro/
  );
  assert.throws(
    () => validarFechasTrabajo(pedido, '2026-05-05', '2026-05-21'),
    /fecha límite de entrega/
  );
  assert.throws(
    () =>
      validarFechasTrabajo(
        pedido,
        '2026-05-06',
        '2026-05-08',
        { fechaInicio: '2026-05-07', fechaFin: '2026-05-09' }
      ),
    /antes de la fecha de inicio de la tarea/
  );
});

test('validarFechasTrabajo ignora el límite cuando el pedido no tiene fecha de entrega', () => {
  const pedido = {
    fechaCreacion: new Date('2026-05-01T00:00:00.000Z'),
    fechaEntrega: null,
  };

  const rango = validarFechasTrabajo(pedido, '2026-05-05', '2026-12-31');
  assert.equal(rango.fin.toISOString().slice(0, 10), '2026-12-31');
});

test('calcularProgreso cuenta actividades completadas y pendientes', () => {
  assert.deepEqual(calcularProgreso([]), {
    total: 0,
    completadas: 0,
    pendientes: 0,
    porcentaje: 0,
  });
  assert.deepEqual(
    calcularProgreso([{ estado: 'Completado' }, { estado: 'Pendiente' }]),
    { total: 2, completadas: 1, pendientes: 1, porcentaje: 50 }
  );
  assert.deepEqual(
    calcularProgreso([{ estado: 'Completado' }, { estado: 'Cancelado' }]),
    { total: 2, completadas: 1, pendientes: 0, porcentaje: 100 }
  );
});

test('requireRoles permite solo los roles indicados y bloquea clientes', () => {
  const permitirAdmin = requireRoles('admin');
  const respuesta = crearRespuesta();
  let siguiente = false;

  permitirAdmin(
    { sesion: { tipoUsuario: 'Usuario' }, usuario: { rol: 'admin' } },
    respuesta,
    () => {
      siguiente = true;
    }
  );
  assert.equal(siguiente, true);

  permitirAdmin(
    { sesion: { tipoUsuario: 'Usuario' }, usuario: { rol: 'trabajador' } },
    respuesta,
    () => {}
  );
  assert.equal(respuesta.codigo, 403);

  const respuestaCliente = crearRespuesta();
  requireAdmin(
    { sesion: { tipoUsuario: 'Cliente' }, usuario: { rol: undefined } },
    respuestaCliente,
    () => {}
  );
  assert.equal(respuestaCliente.codigo, 403);
});

test('la clave de conversación es estable sin importar el orden de los participantes', () => {
  const a = { tipo: 'Usuario', id: '111' };
  const b = { tipo: 'Cliente', id: '222' };

  assert.equal(claveActor(a.tipo, a.id), 'Usuario:111');
  assert.equal(claveConversacion(a, b), claveConversacion(b, a));
  assert.equal(claveConversacion(a, b), 'Cliente:222|Usuario:111');
});

test('serializarMensaje conserva autor, texto y estado de lectura', () => {
  const fecha = new Date('2026-05-10T12:00:00.000Z');
  const datos = serializarMensaje({
    _id: 'mensaje-1',
    conversacion: 'conversacion-1',
    autorId: 'autor-1',
    autorTipo: 'Usuario',
    autorNombre: 'Ana',
    texto: 'Hola',
    leido: true,
    createdAt: fecha,
  });

  assert.equal(datos.texto, 'Hola');
  assert.equal(datos.autorTipo, 'Usuario');
  assert.equal(datos.autorNombre, 'Ana');
  assert.equal(datos.leido, true);
  assert.equal(datos.createdAt, fecha);
});

test('requireAdminOrSecretaria permite ambos roles de gestión', () => {
  for (const rol of ['admin', 'secretaria']) {
    let siguiente = false;
    requireAdminOrSecretaria(
      { sesion: { tipoUsuario: 'Usuario' }, usuario: { rol } },
      crearRespuesta(),
      () => {
        siguiente = true;
      }
    );
    assert.equal(siguiente, true, `rol ${rol} debería pasar`);
  }
});
