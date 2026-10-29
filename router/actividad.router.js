const express = require('express');
const router = express.Router();
const {
  listarActividades,
  tableroActividades,
  obtenerActividad,
  crearActividad,
  actualizarActividad,
  eliminarActividad,
  reactivarActividad,
} = require('../controllers/actividad.controller');

router.get('/', listarActividades);
router.get('/tablero', tableroActividades);
router.get('/:id', obtenerActividad);
router.post('/', crearActividad);
router.put('/:id', actualizarActividad);
router.delete('/:id', eliminarActividad);
router.patch('/:id/reactivar', reactivarActividad);

module.exports = router;
