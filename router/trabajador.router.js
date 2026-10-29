const express = require('express');
const router = express.Router();
const {
  getTrabajadores,
  getTrabajadorById,
  createTrabajador,
  updateTrabajador,
  deleteTrabajador,
  reactivarTrabajador,
} = require('../controllers/trabajador.controller');
const { requireAdminOrSecretaria } = require('../middleware/autenticacion.middleware');

router.get('/', getTrabajadores);
router.get('/:id', getTrabajadorById);
router.post('/', requireAdminOrSecretaria, createTrabajador);
router.put('/:id', requireAdminOrSecretaria, updateTrabajador);
router.delete('/:id', requireAdminOrSecretaria, deleteTrabajador);
router.patch('/:id/reactivar', requireAdminOrSecretaria, reactivarTrabajador);

module.exports = router;
