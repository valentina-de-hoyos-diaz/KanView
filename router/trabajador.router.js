const express = require('express');
const router = express.Router();
const {
  getTrabajadores,
  getTrabajadorById,
  createTrabajador,
  updateTrabajador,
  deleteTrabajador,
} = require('../controllers/trabajador.controller');

router.get('/', getTrabajadores);
router.get('/:id', getTrabajadorById);
router.post('/', createTrabajador);
router.put('/:id', updateTrabajador);
router.delete('/:id', deleteTrabajador);

module.exports = router;
