const express = require('express');
const {
  getTrabajadores,
  getTrabajadorById,
  createTrabajador,
  updateTrabajador,
  deleteTrabajador,
} = require('../controllers/trabajador.controller');

const router = express.Router();

router.get('/', getTrabajadores);
router.get('/:id', getTrabajadorById);
router.post('/', createTrabajador);
router.put('/:id', updateTrabajador);
router.delete('/:id', deleteTrabajador);

module.exports = router;
