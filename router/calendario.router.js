const express = require('express');
const router = express.Router();
const {
  listarEventos,
  eventosDePedidos,
  obtenerEvento,
  crearEvento,
  actualizarEvento,
  eliminarEvento,
  reactivarEvento,
  recordatoriosPendientes,
  marcarRecordatorioEnviado,
} = require('../controllers/calendario.controller');

router.get('/', listarEventos);
router.get('/pedidos', eventosDePedidos);
router.get('/recordatorios', recordatoriosPendientes);
router.patch('/recordatorios/:id', marcarRecordatorioEnviado);
router.get('/:id', obtenerEvento);
router.post('/', crearEvento);
router.put('/:id', actualizarEvento);
router.delete('/:id', eliminarEvento);
router.patch('/:id/reactivar', reactivarEvento);

module.exports = router;
