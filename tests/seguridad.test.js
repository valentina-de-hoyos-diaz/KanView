process.env.MONGODB_URI =
  process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/kanview_test';
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'secreto-de-prueba-con-longitud-suficiente-1234567890';
process.env.API_KEY = process.env.API_KEY || 'api-key-de-prueba';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const config = require('../config/env');
const {
  firmarToken,
  firmarRefreshToken,
  verificarToken,
  verificarRefreshToken,
} = require('../services/autenticacion.service');
const {
  crearLimitador,
  crearCsp,
  cabecerasSeguridad,
  sinCacheApi,
  limitarTamanoSolicitud,
} = require('../middleware/seguridad');
const { obtenerPaginacion, metadatos } = require('../services/paginacion.service');

const respuestaFalsa = () => {
  const res = {
    locals: {},
    headers: {},
    codigo: 200,
    cuerpo: null,
    setHeader(nombre, valor) {
      this.headers[nombre] = valor;
    },
    status(codigo) {
      this.codigo = codigo;
      return this;
    },
    json(cuerpo) {
      this.cuerpo = cuerpo;
      return this;
    },
  };
  return res;
};

test('JWT de acceso válido incluye tipo access y verifica', () => {
  const usuario = { _id: new mongoose.Types.ObjectId(), rol: 'admin' };
  const sesion = { _id: new mongoose.Types.ObjectId(), tipoUsuario: 'Usuario' };
  const token = firmarToken(usuario, sesion);
  const payload = verificarToken(token);

  assert.equal(payload.sub, usuario._id.toString());
  assert.equal(payload.sid, sesion._id.toString());
  assert.equal(payload.rol, 'admin');
  assert.equal(payload.tokenType, 'access');
  assert.equal(typeof payload.jti, 'string');
});

test('JWT rechaza token alterado, expirado, con otro secreto y algoritmo none', () => {
  const usuario = { _id: new mongoose.Types.ObjectId(), rol: 'admin' };
  const sesion = { _id: new mongoose.Types.ObjectId(), tipoUsuario: 'Usuario' };
  const token = firmarToken(usuario, sesion);

  assert.throws(() => verificarToken(`${token}x`), /invalid signature|jwt malformed/);

  const expirado = jwt.sign(
    { sub: usuario._id.toString(), sid: sesion._id.toString(), tokenType: 'access' },
    config.jwtSecret,
    {
      algorithm: 'HS256',
      expiresIn: -1,
      issuer: 'kanview',
      audience: 'kanview-api',
    }
  );
  assert.throws(() => verificarToken(expirado), /expired/);

  const otroSecreto = jwt.sign(
    { sub: usuario._id.toString(), sid: sesion._id.toString(), tokenType: 'access' },
    'otro-secreto-suficientemente-largo-para-la-prueba',
    {
      algorithm: 'HS256',
      expiresIn: '1h',
      issuer: 'kanview',
      audience: 'kanview-api',
    }
  );
  assert.throws(() => verificarToken(otroSecreto), /invalid signature/);

  const sinFirma = jwt.sign(
    { sub: usuario._id.toString(), sid: sesion._id.toString() },
    null,
    { algorithm: 'none', issuer: 'kanview', audience: 'kanview-api' }
  );
  assert.throws(() => verificarToken(sinFirma), /invalid algorithm|jwt signature/);
});

test('refresh token solo sirve para refresh y el access token no sirve como refresh', () => {
  const usuario = { _id: new mongoose.Types.ObjectId(), rol: 'trabajador' };
  const sesion = { _id: new mongoose.Types.ObjectId(), tipoUsuario: 'Usuario' };
  const access = firmarToken(usuario, sesion);
  const refresh = firmarRefreshToken(usuario, sesion);

  assert.equal(verificarRefreshToken(refresh).tokenType, 'refresh');
  assert.throws(() => verificarToken(refresh), /refresh token no sirve/);
  assert.throws(() => verificarRefreshToken(access), /no es un refresh token/);
});

test('rate limit bloquea al superar el máximo y expone cabeceras estándar', () => {
  const limitador = crearLimitador({
    maximo: 2,
    ventanaMs: 60000,
    mensaje: 'límite alcanzado',
    clave: () => 'prueba',
  });

  let permitidos = 0;
  const next = () => {
    permitidos += 1;
  };

  const primera = respuestaFalsa();
  limitador({ ip: '127.0.0.1' }, primera, next);
  const segunda = respuestaFalsa();
  limitador({ ip: '127.0.0.1' }, segunda, next);
  const tercera = respuestaFalsa();
  limitador({ ip: '127.0.0.1' }, tercera, next);

  assert.equal(permitidos, 2);
  assert.equal(tercera.codigo, 429);
  assert.equal(tercera.cuerpo.message, 'límite alcanzado');
  assert.equal(tercera.headers['RateLimit-Remaining'], 0);
  assert.ok(tercera.headers['Retry-After'] > 0);
});

test('CSP genera un nonce por petición y políticas restrictivas', () => {
  const middleware = crearCsp();
  const res = respuestaFalsa();
  let siguiente = false;

  middleware({}, res, () => {
    siguiente = true;
  });

  assert.equal(siguiente, true);
  const nonce = res.locals.cspNonce;
  const csp = res.headers['Content-Security-Policy'];

  assert.ok(nonce && nonce.length >= 20);
  assert.ok(csp.includes(`'nonce-${nonce}'`));
  assert.ok(csp.includes("object-src 'none'"));
  assert.ok(csp.includes("frame-ancestors 'none'"));
  assert.ok(csp.includes("base-uri 'self'"));
  assert.ok(!/script-src[^;]*'unsafe-inline'/.test(csp));
});

test('cabeceras de seguridad incluyen protección de contenido y framing', () => {
  const res = respuestaFalsa();
  cabecerasSeguridad({}, res, () => {});

  assert.equal(res.headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(res.headers['X-Frame-Options'], 'DENY');
  assert.equal(res.headers['X-XSS-Protection'], '0');
  assert.equal(res.headers['Cross-Origin-Resource-Policy'], 'same-origin');
  assert.equal(res.headers['X-Permitted-Cross-Domain-Policies'], 'none');
});

test('las respuestas de API no se cachean y las URLs enormes se rechazan', () => {
  const res = respuestaFalsa();
  sinCacheApi({}, res, () => {});
  assert.equal(res.headers['Cache-Control'], 'no-store');
  assert.equal(res.headers.Pragma, 'no-cache');

  const respuestaGrande = respuestaFalsa();
  limitarTamanoSolicitud({ originalUrl: `/${'a'.repeat(3000)}`, query: {} }, respuestaGrande, () => {});
  assert.equal(respuestaGrande.codigo, 414);

  const respuestaBusqueda = respuestaFalsa();
  limitarTamanoSolicitud(
    { originalUrl: '/api/clientes', query: { q: 'a'.repeat(201) } },
    respuestaBusqueda,
    () => {}
  );
  assert.equal(respuestaBusqueda.codigo, 400);
});

test('paginación normaliza página y límite y calcula metadatos', () => {
  assert.deepEqual(obtenerPaginacion({ pagina: '2', limite: '25' }), {
    pagina: 2,
    limite: 25,
    skip: 25,
  });
  assert.deepEqual(obtenerPaginacion({ pagina: '-1', limite: '9999' }), {
    pagina: 1,
    limite: 200,
    skip: 0,
  });

  assert.deepEqual(metadatos(101, { pagina: 2, limite: 50 }), {
    pagina: 2,
    limite: 50,
    total: 101,
    paginas: 3,
    tieneSiguiente: true,
    tieneAnterior: true,
  });
});

test('todas las vistas usan nonce en sus scripts y escapan datos dinámicos', () => {
  const directorio = path.join(__dirname, '..', 'views', 'pages');
  const vistas = fs.readdirSync(directorio).filter((archivo) => archivo.endsWith('.ejs'));

  for (const vista of vistas) {
    const contenido = fs.readFileSync(path.join(directorio, vista), 'utf8');
    const scriptsSinNonce = contenido.match(/<script(?![^>]*\bnonce=)[^>]*>/g) || [];
    assert.deepEqual(scriptsSinNonce, [], `${vista} tiene scripts sin nonce`);

    if (contenido.includes('innerHTML')) {
      assert.ok(
        contenido.includes('escapeHtml'),
        `${vista} usa innerHTML sin una función de escape`
      );
    }
  }
});

test('todas las vistas privadas usan el mismo sidebar compartido', () => {
  const directorio = path.join(__dirname, '..', 'views', 'pages');
  const vistas = fs
    .readdirSync(directorio)
    .filter((archivo) => archivo.endsWith('.ejs') && !['login.ejs', 'portal.ejs'].includes(archivo));

  for (const vista of vistas) {
    const contenido = fs.readFileSync(path.join(directorio, vista), 'utf8');
    assert.ok(
      contenido.includes("include('../partials/sidebar')"),
      `${vista} no usa el sidebar compartido`
    );
    assert.ok(!contenido.includes('<aside'), `${vista} conserva un sidebar duplicado`);
  }
});

test('las vistas no contienen manejadores inline bloqueados por CSP', () => {
  const directorio = path.join(__dirname, '..', 'views', 'pages');
  const vistas = fs.readdirSync(directorio).filter((archivo) => archivo.endsWith('.ejs'));

  for (const vista of vistas) {
    const contenido = fs.readFileSync(path.join(directorio, vista), 'utf8');
    assert.ok(
      !/\son(click|change|submit|input|load|error|focus|blur)\s*=/i.test(contenido),
      `${vista} contiene un manejador inline`
    );
  }
});
