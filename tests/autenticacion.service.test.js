process.env.MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/kanview_test';
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'secreto-de-prueba-con-longitud-suficiente-1234567890';
process.env.API_KEY = process.env.API_KEY || 'api-key-de-prueba';

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

const {
  hashPassword,
  verificarPassword,
  hashSessionId,
  firmarToken,
  verificarToken,
  compararApiKey,
} = require('../services/autenticacion.service');

test('hashPassword no almacena la contraseña en claro y verifica correctamente', async () => {
  const hash = await hashPassword('Password123');

  assert.notEqual(hash, 'Password123');
  assert.equal(await verificarPassword('Password123', hash), true);
  assert.equal(await verificarPassword('Password124', hash), false);
});

test('hashSessionId es determinista y no devuelve el valor original', () => {
  const hash = hashSessionId('session-de-prueba');

  assert.equal(hash, hashSessionId('session-de-prueba'));
  assert.notEqual(hash, 'session-de-prueba');
  assert.match(hash, /^[a-f0-9]{64}$/);
});

test('firmarToken y verificarToken funcionan en ciclo completo', () => {
  const usuario = { _id: { toString: () => 'usuario-1' }, rol: 'admin' };
  const sesion = { _id: { toString: () => 'sesion-1' } };

  const token = firmarToken(usuario, sesion);
  const payload = verificarToken(token);

  assert.equal(payload.sub, 'usuario-1');
  assert.equal(payload.sid, 'sesion-1');
  assert.equal(payload.rol, 'admin');
});

test('verificarToken rechaza tokens inválidos o firmados con otro secreto', () => {
  assert.throws(() => verificarToken('token-invalido'));

  const tokenAjeno = jwt.sign({ sub: 'x', sid: 'y' }, 'otro-secreto-distinto-al-configurado', {
    algorithm: 'HS256',
    issuer: 'kanview',
    audience: 'kanview-api',
  });

  assert.throws(() => verificarToken(tokenAjeno));
});

test('compararApiKey acepta solo la API key configurada', () => {
  assert.equal(compararApiKey(process.env.API_KEY), true);
  assert.equal(compararApiKey('otra-clave'), false);
  assert.equal(compararApiKey(undefined), false);
  assert.equal(compararApiKey(''), false);
});
