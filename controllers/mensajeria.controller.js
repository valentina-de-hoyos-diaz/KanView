const {
  ErrorDeMensajeria,
  LIMITE_MENSAJE,
  actorDesdeSesion,
  buscarActor,
  contactosDe,
  obtenerOCrearConversacion,
  conversacionVisible,
  conversacionesDe,
  listarMensajes,
  crearMensaje,
  marcarLeidos,
  contarNoLeidos,
  serializarConversacion,
  serializarMensaje,
} = require('../services/mensajeria.service');
const { notificarConversacion } = require('../services/mensajeria.websocket');

const responder = (res, status, message, data = null) =>
  res.status(status).json({ status, message, data });

const responderError = (res, error, contexto) => {
  if (error instanceof ErrorDeMensajeria) {
    return responder(res, error.status, error.message);
  }

  console.error(`[mensajeria] ${contexto}:`, error.message);
  return responder(res, 500, contexto);
};

const actorDe = (req) => actorDesdeSesion(req.sesion);

const listarContactos = async (req, res) => {
  try {
    const contactos = await contactosDe(actorDe(req));
    const conversaciones = await conversacionesDe(actorDe(req));
    const existentes = new Map(
      conversaciones.map((conversacion) => [
        `${conversacion.otro.tipo}:${conversacion.otro.id}`,
        conversacion._id,
      ])
    );

    return responder(
      res,
      200,
      'Contactos obtenidos correctamente',
      contactos.map((contacto) => ({
        ...contacto,
        conversacionId: existentes.get(`${contacto.tipo}:${contacto.id}`) || null,
      }))
    );
  } catch (error) {
    return responderError(res, error, 'Error al obtener los contactos');
  }
};

const listarConversaciones = async (req, res) => {
  try {
    const conversaciones = await conversacionesDe(actorDe(req));
    return responder(res, 200, 'Conversaciones obtenidas correctamente', conversaciones);
  } catch (error) {
    return responderError(res, error, 'Error al obtener las conversaciones');
  }
};

const iniciarConversacion = async (req, res) => {
  try {
    const actor = actorDe(req);
    const { tipo, id } = req.body || {};

    if (!['Usuario', 'Cliente'].includes(tipo) || !id) {
      return responder(res, 400, 'Indica un contacto válido');
    }

    const otro = await buscarActor(tipo, id);
    if (!otro) {
      return responder(res, 404, 'El contacto no existe o está inactivo');
    }

    const conversacion = await obtenerOCrearConversacion(actor, otro);
    const datos = await serializarConversacion(actor, conversacion);
    return responder(res, 200, 'Conversación lista', datos);
  } catch (error) {
    return responderError(res, error, 'Error al iniciar la conversación');
  }
};

const obtenerMensajes = async (req, res) => {
  try {
    const actor = actorDe(req);
    const conversacion = await conversacionVisible(actor, req.params.id);
    const mensajes = await listarMensajes(actor, conversacion._id, req.query.limite);

    if (mensajes.length) {
      notificarConversacion(conversacion, {
        tipo: 'leidos',
        conversacionId: String(conversacion._id),
        actorId: actor.id,
        actorTipo: actor.tipo,
      });
    }

    return responder(res, 200, 'Mensajes obtenidos correctamente', mensajes);
  } catch (error) {
    return responderError(res, error, 'Error al obtener los mensajes');
  }
};

const enviarMensaje = async (req, res) => {
  try {
    const actor = actorDe(req);
    const conversacion = await conversacionVisible(actor, req.params.id);
    const mensaje = await crearMensaje(actor, conversacion, req.body ? req.body.texto : '');

    notificarConversacion(conversacion, {
      tipo: 'mensaje',
      conversacionId: String(conversacion._id),
      mensaje,
    });

    return responder(res, 201, 'Mensaje enviado correctamente', mensaje);
  } catch (error) {
    return responderError(res, error, 'Error al enviar el mensaje');
  }
};

const marcarConversacionLeida = async (req, res) => {
  try {
    const actor = actorDe(req);
    const conversacion = await conversacionVisible(actor, req.params.id);
    const actualizados = await marcarLeidos(conversacion, actor);

    notificarConversacion(conversacion, {
      tipo: 'leidos',
      conversacionId: String(conversacion._id),
      actorId: actor.id,
      actorTipo: actor.tipo,
    });

    return responder(res, 200, 'Mensajes marcados como leídos', { actualizados });
  } catch (error) {
    return responderError(res, error, 'Error al marcar los mensajes');
  }
};

const obtenerNoLeidos = async (req, res) => {
  try {
    const total = await contarNoLeidos(actorDe(req));
    return responder(res, 200, 'Mensajes no leídos obtenidos correctamente', { total });
  } catch (error) {
    return responderError(res, error, 'Error al contar los mensajes no leídos');
  }
};

module.exports = {
  LIMITE_MENSAJE,
  listarContactos,
  listarConversaciones,
  iniciarConversacion,
  obtenerMensajes,
  enviarMensaje,
  marcarConversacionLeida,
  obtenerNoLeidos,
};
