const express = require('express');
const { obtenerPanel } = require('../controllers/panel.controller');

const router = express.Router();

router.get('/', obtenerPanel);

module.exports = router;
