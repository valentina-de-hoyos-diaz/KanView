const express = require('express');
const router = express.Router();
const {
  listarUsuarios,
  obtenerUsuario,
  crearUsuario,
  actualizarUsuario,
  restablecerPassword,
  desactivarUsuario,
} = require('../controllers/usuario.controller');
const { requireAdmin } = require('../middleware/autenticacion.middleware');

router.get('/', listarUsuarios);
router.get('/:id', obtenerUsuario);
router.post('/', crearUsuario);
router.put('/:id', actualizarUsuario);
router.patch('/:id/password', requireAdmin, restablecerPassword);
router.delete('/:id', requireAdmin, desactivarUsuario);

module.exports = router;
