const express = require('express');
const router = express.Router();
const {
  getPedidos,
  getPedidoById,
  createPedido,
  updatePedido,
  deletePedido,
  reactivarPedido,
  aprobarPedido,
  rechazarPedido,
  getHistorialPedido,
} = require('../controllers/pedido.controller');
const {
  requireAdmin,
  requireAdminOrSecretaria,
  requireUsuario,
} = require('../middleware/autenticacion.middleware');

router.get('/', getPedidos);
router.get('/:id/historial', getHistorialPedido);
router.get('/:id', getPedidoById);
router.post('/', createPedido);
router.put('/:id', requireUsuario, updatePedido);
router.patch('/:id/estado', requireAdmin, updatePedido);
router.patch('/:id/aprobar', requireAdminOrSecretaria, aprobarPedido);
router.patch('/:id/rechazar', requireAdminOrSecretaria, rechazarPedido);
router.patch('/:id/reactivar', requireAdminOrSecretaria, reactivarPedido);
router.delete('/:id', requireUsuario, deletePedido);

module.exports = router;
