const express = require('express');
const router = express.Router();

const {
  registro,
  login,
  loginCliente,
  logout,
  me,
} = require('../controllers/autenticacion.controller');
const {
  requireApiKey,
  authenticateUser,
} = require('../middleware/autenticacion.middleware');

router.post('/registro', requireApiKey, registro);
router.post('/login', login);
router.post('/login-cliente', loginCliente);
router.post('/logout', authenticateUser, logout);
router.get('/me', authenticateUser, me);

module.exports = router;
