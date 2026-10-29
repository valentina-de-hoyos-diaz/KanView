const express = require('express');

const {
  authenticateUser,
  requireAdminOrSecretaria,
  requireStaff,
} = require('../middleware/autenticacion.middleware');
const { limitarMensajeria } = require('../middleware/seguridad');

const autenticacionRouter = require('./autenticacion.router');
const clienteRouter = require('./cliente.router');
const trabajadorRouter = require('./trabajador.router');
const productoRouter = require('./producto.router');
const pedidoRouter = require('./pedido.router');
const inventarioRouter = require('./inventario.router');
const usuarioRouter = require('./usuario.router');
const panelRouter = require('./panel.router');
const auditoriaRouter = require('./auditoria.router');
const tareaRouter = require('./tareaPedido.router');
const actividadRouter = require('./actividad.router');
const calendarioRouter = require('./calendario.router');
const finanzaRouter = require('./finanza.router');
const mensajeriaRouter = require('./mensajeria.router');

const router = express.Router();

router.use('/auth', autenticacionRouter);

router.use('/panel', authenticateUser, requireStaff, panelRouter);
router.use('/clientes', authenticateUser, requireStaff, clienteRouter);
router.use('/trabajadores', authenticateUser, requireStaff, trabajadorRouter);
router.use('/productos', authenticateUser, productoRouter);
router.use('/pedidos', authenticateUser, pedidoRouter);
router.use('/inventario', authenticateUser, requireStaff, inventarioRouter);
router.use('/tareas', authenticateUser, requireStaff, tareaRouter);
router.use('/actividades', authenticateUser, requireStaff, actividadRouter);
router.use('/calendario', authenticateUser, requireStaff, calendarioRouter);
router.use('/finanzas', authenticateUser, requireAdminOrSecretaria, finanzaRouter);
router.use('/usuarios', authenticateUser, requireAdminOrSecretaria, usuarioRouter);
router.use('/auditoria', authenticateUser, requireAdminOrSecretaria, auditoriaRouter);
router.use('/mensajeria', authenticateUser, limitarMensajeria, mensajeriaRouter);

module.exports = router;
