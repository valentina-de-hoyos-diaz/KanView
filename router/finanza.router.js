const express = require('express');
const router = express.Router();
const {
  listarFinanzas,
  resumenFinanciero,
  crearFinanza,
  actualizarFinanza,
  eliminarFinanza,
} = require('../controllers/finanza.controller');

router.get('/', listarFinanzas);
router.get('/resumen', resumenFinanciero);
router.post('/', crearFinanza);
router.put('/:id', actualizarFinanza);
router.delete('/:id', eliminarFinanza);

module.exports = router;
