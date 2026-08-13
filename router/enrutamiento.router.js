const express = require('express');
const trabajadorRouter = require('./trabajador.router');
const pedidoRouter = require('./pedido.router');

const router = express.Router();

router.use('/trabajadores', trabajadorRouter);
router.use('/pedidos', pedidoRouter);

module.exports = router;