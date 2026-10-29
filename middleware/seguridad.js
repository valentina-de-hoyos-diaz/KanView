const crypto = require('crypto');
const config = require('../config/env');

const cabecerasSeguridad = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

  if (config.entorno === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  return next();
};

const sinCacheApi = (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
  return next();
};

const limitarTamanoSolicitud = (req, res, next) => {
  if (req.originalUrl.length > 2048) {
    return res.status(414).json({
      status: 414,
      message: 'La URL de la petición es demasiado larga',
      data: null,
    });
  }

  if (req.query && typeof req.query.q === 'string' && req.query.q.length > 200) {
    return res.status(400).json({
      status: 400,
      message: 'El término de búsqueda es demasiado largo',
      data: null,
    });
  }

  return next();
};

const crearCsp = () => (req, res, next) => {
  const nonce = crypto.randomBytes(18).toString('base64');
  res.locals.cspNonce = nonce;

  const directivas = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' https://cdn.tailwindcss.com`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "media-src 'self' blob: https:",
    "connect-src 'self' ws: wss:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];

  res.setHeader(
    config.cspReportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy',
    directivas.join('; ')
  );

  return next();
};

const crearLimitador = ({
  maximo,
  ventanaMs,
  mensaje,
  clave = (req) => req.ip || (req.socket && req.socket.remoteAddress) || 'desconocido',
}) => {
  const registros = new Map();

  const limpiar = (ahora) => {
    for (const [llave, registro] of registros.entries()) {
      if (registro.expira <= ahora) {
        registros.delete(llave);
      }
    }
  };

  return (req, res, next) => {
    const ahora = Date.now();
    const llave = clave(req);
    const registro = registros.get(llave);

    if (!registro || registro.expira <= ahora) {
      registros.set(llave, { conteo: 1, expira: ahora + ventanaMs });
    } else {
      registro.conteo += 1;

      if (registro.conteo > maximo) {
        const segundos = Math.max(Math.ceil((registro.expira - ahora) / 1000), 1);
        res.setHeader('Retry-After', segundos);
        res.setHeader('RateLimit-Limit', maximo);
        res.setHeader('RateLimit-Remaining', 0);
        res.setHeader('RateLimit-Reset', segundos);
        return res.status(429).json({
          status: 429,
          message: mensaje,
          data: null,
        });
      }
    }

    const actual = registros.get(llave);
    res.setHeader('RateLimit-Limit', maximo);
    res.setHeader('RateLimit-Remaining', Math.max(maximo - actual.conteo, 0));
    res.setHeader(
      'RateLimit-Reset',
      Math.max(Math.ceil((actual.expira - ahora) / 1000), 1)
    );

    if (registros.size > 10000) {
      limpiar(ahora);
    }

    return next();
  };
};

const claveSesion = (req) => {
  if (req.sesion && req.sesion.usuario) {
    return `${req.sesion.tipoUsuario || 'Usuario'}:${req.sesion.usuario._id || req.sesion.usuario}`;
  }
  return req.ip || (req.socket && req.socket.remoteAddress) || 'desconocido';
};

const limitarLogin = crearLimitador({
  maximo: config.rateLimit.loginMax,
  ventanaMs: config.rateLimit.loginWindowMs,
  mensaje: 'Demasiados intentos de inicio de sesión. Espera unos minutos.',
});

const limitarApi = crearLimitador({
  maximo: config.rateLimit.apiMax,
  ventanaMs: config.rateLimit.apiWindowMs,
  mensaje: 'Demasiadas peticiones. Intenta de nuevo en un momento.',
});

const limitarMensajeria = crearLimitador({
  maximo: config.rateLimit.mensajesMax,
  ventanaMs: config.rateLimit.mensajesWindowMs,
  mensaje: 'Demasiados mensajes seguidos. Espera unos segundos.',
  clave: claveSesion,
});

module.exports = {
  cabecerasSeguridad,
  crearCsp,
  sinCacheApi,
  limitarTamanoSolicitud,
  limitarLogin,
  limitarApi,
  limitarMensajeria,
  crearLimitador,
};
