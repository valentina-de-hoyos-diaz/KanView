const express = require('express');
const router = express.Router();
const {
  getProductos,
  getProductoById,
  createProducto,
  updateProducto,
  deleteProducto,
  reactivarProducto,
} = require('../controllers/producto.controller');
const { requireUsuario } = require('../middleware/autenticacion.middleware');

router.get('/', getProductos);
router.get('/:id', getProductoById);
router.post('/', requireUsuario, createProducto);
router.put('/:id', requireUsuario, updateProducto);
router.delete('/:id', requireUsuario, deleteProducto);
router.patch('/:id/reactivar', requireUsuario, reactivarProducto);

module.exports = router;
