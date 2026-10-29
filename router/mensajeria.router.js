const express = require('express');
const router = express.Router();
const {
  listarContactos,
  listarConversaciones,
  iniciarConversacion,
  obtenerMensajes,
  enviarMensaje,
  marcarConversacionLeida,
  obtenerNoLeidos,
} = require('../controllers/mensajeria.controller');

router.get('/contactos', listarContactos);
router.get('/conversaciones', listarConversaciones);
router.post('/conversaciones', iniciarConversacion);
router.get('/conversaciones/:id/mensajes', obtenerMensajes);
router.post('/conversaciones/:id/mensajes', enviarMensaje);
router.patch('/conversaciones/:id/leidos', marcarConversacionLeida);
router.get('/no-leidos', obtenerNoLeidos);

module.exports = router;
