const { WebSocketServer } = require('ws');

const { verificarToken, buscarSesionPorId } = require('./autenticacion.service');
const {
  actorDesdeSesion,
  claveActor,
  conversacionVisible,
  crearMensaje,
  marcarLeidos,
  contarNoLeidos,
} = require('./mensajeria.service');

const RUTA_WEBSOCKET = '/ws/mensajeria';
const LIMITE_MENSAJES = 30;
const VENTANA_MS = 10000;

const conexiones = new Map();
let servidorWebSocket = null;

const enviar = (socket, payload) => {
  if (socket.readyState === 1) {
    socket.send(JSON.stringify(payload));
  }
};

const agregarConexion = (actor, socket) => {
  const clave = claveActor(actor.tipo, actor.id);
  if (!conexiones.has(clave)) conexiones.set(clave, new Set());
  conexiones.get(clave).add(socket);
};

const quitarConexion = (actor, socket) => {
  const clave = claveActor(actor.tipo, actor.id);
  const sockets = conexiones.get(clave);
  if (!sockets) return;
  sockets.delete(socket);
  if (sockets.size === 0) conexiones.delete(clave);
};

const notificarConversacion = (conversacion, payload) => {
  if (!conversacion || !conversacion.participantes) return;

  conversacion.participantes.forEach((participante) => {
    const sockets = conexiones.get(claveActor(participante.tipo, participante.id));
    if (!sockets) return;
    sockets.forEach((socket) => enviar(socket, payload));
  });
};

const responderErrorCrudo = (socket, status, mensaje) => {
  socket.write(`HTTP/1.1 ${status} ${mensaje}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
};

const autenticarSolicitud = async (request) => {
  const url = new URL(request.url, 'http://localhost');
  if (url.pathname !== RUTA_WEBSOCKET) return null;

  const token = url.searchParams.get('token');
  if (!token) return false;

  let payload;
  try {
    payload = verificarToken(token);
  } catch (error) {
    return false;
  }

  const sesion = await buscarSesionPorId(payload.sid);
  if (!sesion) return false;

  return { sesion, actor: actorDesdeSesion(sesion) };
};

const manejarMensaje = async (socket, actor, data) => {
  if (!data || typeof data !== 'object') return;

  if (data.tipo === 'ping') {
    enviar(socket, { tipo: 'pong', fecha: new Date().toISOString() });
    return;
  }

  if (data.tipo === 'mensaje') {
    const ahora = Date.now();
    socket.envios = (socket.envios || []).filter((fecha) => ahora - fecha < VENTANA_MS);
    if (socket.envios.length >= LIMITE_MENSAJES) {
      enviar(socket, {
        tipo: 'error',
        detalle: 'Demasiados mensajes seguidos. Espera unos segundos.',
      });
      return;
    }
    socket.envios.push(ahora);

    const conversacion = await conversacionVisible(actor, data.conversacionId);
    const mensaje = await crearMensaje(actor, conversacion, data.texto);
    notificarConversacion(conversacion, {
      tipo: 'mensaje',
      conversacionId: String(conversacion._id),
      mensaje,
    });
    return;
  }

  if (data.tipo === 'leidos') {
    const conversacion = await conversacionVisible(actor, data.conversacionId);
    const actualizados = await marcarLeidos(conversacion, actor);
    notificarConversacion(conversacion, {
      tipo: 'leidos',
      conversacionId: String(conversacion._id),
      actorId: actor.id,
      actorTipo: actor.tipo,
      actualizados,
    });
  }
};

const inicializarMensajeriaWebSocket = (server) => {
  if (servidorWebSocket) return servidorWebSocket;

  servidorWebSocket = new WebSocketServer({ noServer: true });

  server.on('upgrade', async (request, socket, head) => {
    let autenticacion;
    try {
      autenticacion = await autenticarSolicitud(request);
    } catch (error) {
      console.error('[mensajeria-ws] Error de autenticación:', error.message);
      responderErrorCrudo(socket, 500, 'Internal Server Error');
      return;
    }

    if (autenticacion === null) {
      responderErrorCrudo(socket, 404, 'Not Found');
      return;
    }

    if (autenticacion === false) {
      responderErrorCrudo(socket, 401, 'Unauthorized');
      return;
    }

    servidorWebSocket.handleUpgrade(request, socket, head, (websocket) => {
      servidorWebSocket.emit('connection', websocket, request, autenticacion);
    });
  });

  servidorWebSocket.on('connection', async (socket, request, autenticacion) => {
    const { actor } = autenticacion;
    socket.actor = actor;
    socket.envios = [];
    agregarConexion(actor, socket);

    enviar(socket, { tipo: 'conectado', actor });
    contarNoLeidos(actor)
      .then((total) => enviar(socket, { tipo: 'no-leidos', total }))
      .catch((error) => console.error('[mensajeria-ws] No se pudo contar no leídos:', error.message));

    socket.on('message', async (crudo) => {
      try {
        const data = JSON.parse(crudo.toString());
        await manejarMensaje(socket, actor, data);
      } catch (error) {
        enviar(socket, {
          tipo: 'error',
          detalle: error.message || 'No se pudo procesar el mensaje',
        });
      }
    });

    socket.on('close', () => quitarConexion(actor, socket));
    socket.on('error', (error) => {
      console.error('[mensajeria-ws] Error de socket:', error.message);
      quitarConexion(actor, socket);
    });
  });

  return servidorWebSocket;
};

module.exports = {
  RUTA_WEBSOCKET,
  inicializarMensajeriaWebSocket,
  notificarConversacion,
};
