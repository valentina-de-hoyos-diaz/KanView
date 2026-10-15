const test = require('node:test');
const assert = require('node:assert/strict');

const Producto = require('../models/producto.model');
const { CATEGORIAS, normalizarDatos } = require('../services/producto.service');

test('normalizarDatos acepta un producto válido y normaliza sus campos', () => {
  const { errores, campos } = normalizarDatos({
    nombre: '  Silla ergonómica  ',
    codigoProducto: ' P-001 ',
    descripcion: 'Silla de oficina con soporte lumbar',
    categoria: 'Oficina',
    precio: 199.99,
    stock: 10,
  });

  assert.equal(errores.length, 0);
  assert.equal(campos.nombre, 'Silla ergonómica');
  assert.equal(campos.codigoProducto, 'P-001');
  assert.equal(campos.categoria, 'Oficina');
  assert.equal(campos.precio.toString(), '199.99');
  assert.equal(campos.stock, 10);
});

test('normalizarDatos rechaza campos obligatorios vacíos o ausentes', () => {
  const { errores, campos } = normalizarDatos({ nombre: '   ', categoria: 'Hogar' });

  assert.deepEqual(Object.keys(campos), ['categoria']);
  assert.equal(campos.categoria, 'Hogar');
  assert.equal(errores.length, 5);
  assert.ok(errores.some((error) => error.startsWith('nombre')));
  assert.ok(errores.some((error) => error.startsWith('codigoProducto')));
  assert.ok(errores.some((error) => error.startsWith('descripcion')));
  assert.ok(errores.some((error) => error.startsWith('precio')));
  assert.ok(errores.some((error) => error.startsWith('stock')));
});

test('normalizarDatos rechaza categorías fuera del enum', () => {
  const { errores } = normalizarDatos({ categoria: 'Juguetes' });

  assert.ok(errores.some((error) => error.startsWith('categoria')));
});

test('normalizarDatos rechaza precio negativo o no numérico', () => {
  assert.ok(normalizarDatos({ precio: -1 }).errores.some((e) => e.startsWith('precio')));
  assert.ok(normalizarDatos({ precio: 'abc' }).errores.some((e) => e.startsWith('precio')));
});

test('normalizarDatos rechaza stock negativo o no entero', () => {
  assert.ok(normalizarDatos({ stock: -5 }).errores.some((e) => e.startsWith('stock')));
  assert.ok(normalizarDatos({ stock: 1.5 }).errores.some((e) => e.startsWith('stock')));
});

test('normalizarDatos en modo parcial solo valida los campos enviados', () => {
  const { errores, campos } = normalizarDatos({ stock: 7 }, { parcial: true });

  assert.equal(errores.length, 0);
  assert.deepEqual(Object.keys(campos), ['stock']);
  assert.equal(campos.stock, 7);
});

test('normalizarDatos en modo parcial marca error si un campo enviado es inválido', () => {
  const { errores, campos } = normalizarDatos({ categoria: 'Oficina', precio: -10 }, { parcial: true });

  assert.equal(errores.length, 1);
  assert.deepEqual(Object.keys(campos), ['categoria']);
});

test('las categorías del service coinciden con el enum del modelo', () => {
  assert.deepEqual(CATEGORIAS, Producto.schema.path('categoria').enumValues);
});
