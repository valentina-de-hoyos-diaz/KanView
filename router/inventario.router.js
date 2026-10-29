const express = require('express');
const router = express.Router();
const {
  getInventarios,
  getResumenInventario,
  getInventarioById,
  createInventario,
  updateInventario,
  deleteInventario,
} = require('../controllers/inventario.controller');

router.get('/', getInventarios);
router.get('/resumen', getResumenInventario);
router.get('/:id', getInventarioById);
router.post('/', createInventario);
router.put('/:id', updateInventario);
router.delete('/:id', deleteInventario);

module.exports = router;
