const express = require('express');
const router = express.Router();

const {
  registro,
  login,
  loginCliente,
  refresh,
  logout,
  me,
} = require('../controllers/autenticacion.controller');
const {
  requireApiKey,
  authenticateUser,
} = require('../middleware/autenticacion.middleware');
const { limitarLogin } = require('../middleware/seguridad');

router.post('/registro', limitarLogin, requireApiKey, registro);
router.post('/login', limitarLogin, login);
router.post('/login-cliente', limitarLogin, loginCliente);
router.post('/refresh', limitarLogin, refresh);
router.post('/logout', authenticateUser, logout);
router.get('/me', authenticateUser, me);

module.exports = router;
