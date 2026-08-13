const express = require('express');

const actividadController = require('../controllers/actividad.controller')
const administradorController = require('../controllers/administrador.controller')
const calendarioController = require('../controllers/calendario.controller')
const clienteController = require('../controllers/cliente.controller')
const finanzaController = require('../controllers/.controller')
const calendarioController = require('../controllers/finanza.controller')
const historialController = require('../controllers/historial.controller')
const inventarioController = require('../controllers/inventario.controller')
const pedidoController = require('../controllers/pedido.controller')
const productoController = require('../controllers/producto.controller')
const tareaPedidoController = require('../controllers/tareaPedido.controller')
const trabajadorController = require('../controllers/trabajador.controller')
const inventarioController = require('../controllers/inventario.controller')

const router = express.Router();

//Enrutamiento de trabajador
router.get('/trabajadores', trabajadorController.getTrabajadores);
router.get('/trabajadores/:id', trabajadorController.getTrabajadorById);
router.post('/trabajadores', trabajadorController.createTrabajador);
router.put('/trabajadores/:id', trabajadorController.updateTrabajador);
router.delete('/trabajadores/:id', trabajadorController.deleteTrabajador);

//Enrutamiento de inventario
router.get('/inventario', inventarioController.getInventarios);
router.get('/inventario/:id', inventarioController.getInventarioById);
router.post('/inventario', inventarioController.createInventario);
router.put('/inventario/:id', inventarioController.updateInventario);
router.delete('/inventario/:id', inventarioController.deleteInventario);

module.exports = router;