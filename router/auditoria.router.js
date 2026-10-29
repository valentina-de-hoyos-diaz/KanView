const express = require('express');
const { listarAuditoria } = require('../controllers/auditoria.controller');

const router = express.Router();

router.get('/', listarAuditoria);

module.exports = router;
