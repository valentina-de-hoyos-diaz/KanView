const express = require('express');
const router = express.Router();
const {
  getPedidos,
  getPedidoById,
  createPedido,
  updatePedido,
  deletePedido,
} = require('../controllers/pedido.controller');

router.get('/', getPedidos);
router.get('/:id', getPedidoById);
router.post('/', createPedido);
router.put('/:id', updatePedido);
router.delete('/:id', deletePedido);

module.exports = router;
