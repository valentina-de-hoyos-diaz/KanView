const express = require('express');
const router = express.Router();
const {
  getPedidos,
  getPedidoById,
  createPedido,
  updatePedido,
  deletePedido,
} = require('../controllers/pedido.controller');
const { requireUsuario } = require('../middleware/autenticacion.middleware');

router.get('/', getPedidos);
router.get('/:id', getPedidoById);
router.post('/', createPedido);
router.put('/:id', requireUsuario, updatePedido);
router.delete('/:id', requireUsuario, deletePedido);

module.exports = router;
