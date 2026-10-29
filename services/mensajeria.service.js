const mongoose = require('mongoose');

const Usuario = require('../models/usuario.model');
const Cliente = require('../models/cliente.model');
const Pedido = require('../models/pedido.model');
const TareaPedido = require('../models/tareaPedido.model');
const Actividad = require('../models/actividad.model');
const Conversacion = require('../models/conversacion.model');
const Mensaje = require('../models/mensaje.model');

const LIMITE_MENSAJE = 2000;
const LIMITE_MENSAJES = 50;

class ErrorDeMensajeria extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const claveActor = (tipo, id) => `${tipo}:${String(id)}`;

const claveConversacion = (a, b) =>
  [claveActor(a.tipo, a.id), claveActor(b.tipo, b.id)].sort().join('|');

const persona = (documento, tipo) => {
  if (!documento) return null;

  let rol = 'cliente';
  if (tipo === 'Usuario') {
    rol = documento.rol || 'trabajador';
  }

  const nombre = documento.nombre || 'Usuario';
  return {
    id: String(documento._id),
    tipo,
    nombre,
    rol,
    email: documento.email || documento.correo || '',
    trabajadorId: documento.trabajadorId ? String(documento.trabajadorId) : null,
    iniciales: nombre
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((parte) => parte.charAt(0).toUpperCase())
      .join(''),
  };
};

const actorDesdeSesion = (sesion) => {
  if (!sesion || !sesion.usuario) {
    throw new ErrorDeMensajeria(401, 'Sesión inválida');
  }
  return persona(sesion.usuario, sesion.tipoUsuario === 'Cliente' ? 'Cliente' : 'Usuario');
};

const buscarActor = async (tipo, id) => {
  if (!mongoose.isValidObjectId(id) || !['Usuario', 'Cliente'].includes(tipo)) {
    return null;
  }

  if (tipo === 'Usuario') {
    const usuario = await Usuario.findById(id);
    if (!usuario || usuario.activo === false) return null;
    return persona(usuario, 'Usuario');
  }

  const cliente = await Cliente.findById(id);
  if (!cliente || cliente.activo === false) return null;
  return persona(cliente, 'Cliente');
};

const idsDePedidosDelTrabajador = async (trabajadorId) => {
  const pedidosDirectos = await Pedido.find({ empleadoId: trabajadorId }).select('_id');
  const tareas = await TareaPedido.find({ empleadoId: trabajadorId }).select('_id idPedido');
  const actividades = await Actividad.find({ empleadoId: trabajadorId }).select('_id idTarea');
  const idsTareas = actividades.map((actividad) => actividad.idTarea).filter(Boolean);
  const tareasDeActividades = idsTareas.length
    ? await TareaPedido.find({ _id: { $in: idsTareas } }).select('_id idPedido')
    : [];

  const idsPedidos = new Set(pedidosDirectos.map((pedido) => String(pedido._id)));
  tareas.forEach((tarea) => idsPedidos.add(String(tarea.idPedido)));
  tareasDeActividades.forEach((tarea) => idsPedidos.add(String(tarea.idPedido)));
  return [...idsPedidos].filter((id) => mongoose.isValidObjectId(id));
};

const idsTrabajadoresDeCliente = async (clienteId) => {
  const pedidos = await Pedido.find({ cliente: clienteId }).select('_id empleadoId');
  const idsPedidos = pedidos.map((pedido) => pedido._id);
  const tareas = idsPedidos.length
    ? await TareaPedido.find({ idPedido: { $in: idsPedidos } }).select('_id empleadoId')
    : [];
  const idsTareas = tareas.map((tarea) => tarea._id);
  const actividades = idsTareas.length
    ? await Actividad.find({ idTarea: { $in: idsTareas } }).select('empleadoId')
    : [];

  const ids = new Set(
    pedidos.map((pedido) => pedido.empleadoId).filter(Boolean).map((id) => String(id))
  );
  tareas.forEach((tarea) => {
    if (tarea.empleadoId) ids.add(String(tarea.empleadoId));
  });
  actividades.forEach((actividad) => {
    if (actividad.empleadoId) ids.add(String(actividad.empleadoId));
  });
  return [...ids].filter((id) => mongoose.isValidObjectId(id));
};

const contactosDe = async (actor) => {
  const contactos = new Map();

  const agregar = (personaContacto) => {
    if (!personaContacto) return;
    const clave = claveActor(personaContacto.tipo, personaContacto.id);
    if (clave === claveActor(actor.tipo, actor.id)) return;
    contactos.set(clave, personaContacto);
  };

  if (actor.tipo === 'Usuario') {
    if (['admin', 'secretaria'].includes(actor.rol)) {
      const [usuarios, clientes] = await Promise.all([
        Usuario.find({ activo: { $ne: false }, _id: { $ne: actor.id } }),
        Cliente.find({ activo: { $ne: false } }),
      ]);
      usuarios.forEach((usuario) => agregar(persona(usuario, 'Usuario')));
      clientes.forEach((cliente) => agregar(persona(cliente, 'Cliente')));
    } else if (actor.trabajadorId) {
      const pedidosIds = await idsDePedidosDelTrabajador(actor.trabajadorId);
      if (pedidosIds.length) {
        const pedidos = await Pedido.find({ _id: { $in: pedidosIds } }).select('cliente');
        const clientesIds = [...new Set(pedidos.map((pedido) => String(pedido.cliente)))];
        const clientes = await Cliente.find({
          _id: { $in: clientesIds },
          activo: { $ne: false },
        });
        clientes.forEach((cliente) => agregar(persona(cliente, 'Cliente')));
      }
    }
  }

  if (actor.tipo === 'Cliente') {
    const trabajadoresIds = await idsTrabajadoresDeCliente(actor.id);
    if (trabajadoresIds.length) {
      const usuarios = await Usuario.find({
        trabajadorId: { $in: trabajadoresIds },
        activo: { $ne: false },
      });
      usuarios.forEach((usuario) => agregar(persona(usuario, 'Usuario')));
    }
  }

  const conversaciones = await Conversacion.find({
    participantes: { $elemMatch: { id: actor.id, tipo: actor.tipo } },
    activa: { $ne: false },
  }).select('participantes');

  const otros = [];
  conversaciones.forEach((conversacion) => {
    conversacion.participantes.forEach((participante) => {
      if (String(participante.id) !== String(actor.id) || participante.tipo !== actor.tipo) {
        otros.push(participante);
      }
    });
  });

  await Promise.all(
    otros.map(async (participante) => {
      const personaContacto = await buscarActor(participante.tipo, participante.id);
      agregar(personaContacto);
    })
  );

  return [...contactos.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
};

const puedeHablarCon = async (actor, otro) => {
  if (!otro || String(actor.id) === String(otro.id) && actor.tipo === otro.tipo) return false;
  const contactos = await contactosDe(actor);
  return contactos.some(
    (contacto) => contacto.id === String(otro.id) && contacto.tipo === otro.tipo
  );
};

const obtenerOCrearConversacion = async (actor, otro) => {
  if (String(actor.id) === String(otro.id) && actor.tipo === otro.tipo) {
    throw new ErrorDeMensajeria(400, 'No puedes iniciar una conversación contigo mismo');
  }

  if (!(await puedeHablarCon(actor, otro))) {
    throw new ErrorDeMensajeria(403, 'No puedes iniciar una conversación con ese usuario');
  }

  const clave = claveConversacion(actor, otro);
  const conversacion = await Conversacion.findOneAndUpdate(
    { clave },
    {
      $setOnInsert: {
        clave,
        participantes: [
          { id: actor.id, tipo: actor.tipo },
          { id: otro.id, tipo: otro.tipo },
        ],
        ultimaActividad: new Date(),
        activa: true,
      },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );

  return conversacion;
};

const conversacionVisible = async (actor, conversacionId) => {
  if (!mongoose.isValidObjectId(conversacionId)) {
    throw new ErrorDeMensajeria(400, 'El ID de la conversación no es válido');
  }

  const conversacion = await Conversacion.findOne({
    _id: conversacionId,
    activa: { $ne: false },
    participantes: { $elemMatch: { id: actor.id, tipo: actor.tipo } },
  });

  if (!conversacion) {
    throw new ErrorDeMensajeria(404, 'Conversación no encontrada');
  }

  return conversacion;
};

const otroParticipante = (conversacion, actor) =>
  conversacion.participantes.find(
    (participante) =>
      String(participante.id) !== String(actor.id) || participante.tipo !== actor.tipo
  );

const serializarMensaje = (mensaje) => ({
  _id: mensaje._id,
  conversacion: mensaje.conversacion,
  texto: mensaje.texto,
  autorId: mensaje.autorId,
  autorTipo: mensaje.autorTipo,
  autorNombre: mensaje.autorNombre,
  leido: mensaje.leido,
  createdAt: mensaje.createdAt,
});

const ultimosMensajes = async (ids) => {
  if (!ids.length) return new Map();
  const filas = await Mensaje.aggregate([
    { $match: { conversacion: { $in: ids } } },
    { $sort: { createdAt: -1 } },
    { $group: { _id: '$conversacion', mensaje: { $first: '$$ROOT' } } },
  ]);
  return new Map(filas.map((fila) => [String(fila._id), fila.mensaje]));
};

const noLeidosPorConversacion = async (actor, ids) => {
  if (!ids.length) return new Map();
  const filas = await Mensaje.aggregate([
    {
      $match: {
        conversacion: { $in: ids },
        leido: false,
        autorId: { $ne: new mongoose.Types.ObjectId(actor.id) },
      },
    },
    { $group: { _id: '$conversacion', total: { $sum: 1 } } },
  ]);
  return new Map(filas.map((fila) => [String(fila._id), fila.total]));
};

const serializarConversacion = async (actor, conversacion, ultimo = null, noLeidos = 0) => {
  const participante = otroParticipante(conversacion, actor);
  const otro = participante ? await buscarActor(participante.tipo, participante.id) : null;

  return {
    _id: conversacion._id,
    otro: otro || {
      id: participante ? String(participante.id) : '',
      tipo: participante ? participante.tipo : '',
      nombre: 'Usuario eliminado',
      rol: '',
      iniciales: '?',
    },
    ultimoMensaje: ultimo ? serializarMensaje(ultimo) : null,
    noLeidos,
    ultimaActividad: conversacion.ultimaActividad,
  };
};

const conversacionesDe = async (actor) => {
  const conversaciones = await Conversacion.find({
    participantes: { $elemMatch: { id: actor.id, tipo: actor.tipo } },
    activa: { $ne: false },
  }).sort({ ultimaActividad: -1 });

  const ids = conversaciones.map((conversacion) => conversacion._id);
  const [ultimos, noLeidos] = await Promise.all([
    ultimosMensajes(ids),
    noLeidosPorConversacion(actor, ids),
  ]);

  return Promise.all(
    conversaciones.map((conversacion) =>
      serializarConversacion(
        actor,
        conversacion,
        ultimos.get(String(conversacion._id)),
        noLeidos.get(String(conversacion._id)) || 0
      )
    )
  );
};

const listarMensajes = async (actor, conversacionId, limite = LIMITE_MENSAJES) => {
  const conversacion = await conversacionVisible(actor, conversacionId);
  const cantidad = Math.min(Math.max(Number(limite) || LIMITE_MENSAJES, 1), 100);

  const mensajes = await Mensaje.find({ conversacion: conversacion._id })
    .sort({ createdAt: -1 })
    .limit(cantidad);

  await marcarLeidos(conversacion, actor);

  return mensajes.reverse().map(serializarMensaje);
};

const crearMensaje = async (actor, conversacion, texto) => {
  const contenido = typeof texto === 'string' ? texto.trim() : '';
  if (!contenido) {
    throw new ErrorDeMensajeria(400, 'El mensaje no puede estar vacío');
  }

  if (contenido.length > LIMITE_MENSAJE) {
    throw new ErrorDeMensajeria(400, `El mensaje no puede superar ${LIMITE_MENSAJE} caracteres`);
  }

  const mensaje = await Mensaje.create({
    conversacion: conversacion._id,
    autorId: actor.id,
    autorTipo: actor.tipo,
    autorNombre: actor.nombre,
    texto: contenido,
    leido: false,
  });

  await Conversacion.updateOne(
    { _id: conversacion._id },
    { $set: { ultimaActividad: new Date() } }
  );

  return serializarMensaje(mensaje);
};

const marcarLeidos = async (conversacion, actor) => {
  const resultado = await Mensaje.updateMany(
    {
      conversacion: conversacion._id,
      leido: false,
      autorId: { $ne: new mongoose.Types.ObjectId(actor.id) },
    },
    { $set: { leido: true } }
  );

  return resultado.modifiedCount || 0;
};

const contarNoLeidos = async (actor) => {
  const conversaciones = await Conversacion.find({
    participantes: { $elemMatch: { id: actor.id, tipo: actor.tipo } },
    activa: { $ne: false },
  }).select('_id');

  if (!conversaciones.length) return 0;

  return Mensaje.countDocuments({
    conversacion: { $in: conversaciones.map((conversacion) => conversacion._id) },
    leido: false,
    autorId: { $ne: new mongoose.Types.ObjectId(actor.id) },
  });
};

module.exports = {
  ErrorDeMensajeria,
  LIMITE_MENSAJE,
  actorDesdeSesion,
  claveActor,
  claveConversacion,
  buscarActor,
  contactosDe,
  puedeHablarCon,
  obtenerOCrearConversacion,
  conversacionVisible,
  otroParticipante,
  conversacionesDe,
  listarMensajes,
  crearMensaje,
  marcarLeidos,
  contarNoLeidos,
  serializarMensaje,
  serializarConversacion,
};
