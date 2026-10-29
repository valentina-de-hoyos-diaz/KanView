const express = require('express');
const router = express.Router();
const {
  getClientes,
  getClienteById,
  createCliente,
  updateCliente,
  deleteCliente,
} = require('../controllers/cliente.controller');
const { requireAdminOrSecretaria } = require('../middleware/autenticacion.middleware');

router.get('/', getClientes);
router.get('/:id', getClienteById);
router.post('/', requireAdminOrSecretaria, createCliente);
router.put('/:id', requireAdminOrSecretaria, updateCliente);
router.delete('/:id', requireAdminOrSecretaria, deleteCliente);

module.exports = router;
