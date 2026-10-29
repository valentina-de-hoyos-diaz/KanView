const express = require('express');
const router = express.Router();
const {
  listarTareas,
  obtenerTarea,
  crearTarea,
  actualizarTarea,
  confirmarTarea,
  eliminarTarea,
  reactivarTarea,
} = require('../controllers/tareaPedido.controller');

router.get('/', listarTareas);
router.get('/:id', obtenerTarea);
router.post('/', crearTarea);
router.put('/:id', actualizarTarea);
router.patch('/:id/confirmar', confirmarTarea);
router.delete('/:id', eliminarTarea);
router.patch('/:id/reactivar', reactivarTarea);

module.exports = router;
