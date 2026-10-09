const path = require('path');
const express = require('express');

const config = require('./config/env');
require('./config/connectiondb');

const autenticacionRouter = require('./router/autenticacion.router');
const trabajadorRouter = require('./router/trabajador.router');
const pedidoRouter = require('./router/pedido.router');
const { authenticate } = require('./middleware/autenticacion.middleware');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', autenticacionRouter);
app.use('/api/trabajadores', authenticate, trabajadorRouter);
app.use('/api/pedidos', authenticate, pedidoRouter);

app.get('/', (req, res) => {
  res.redirect('/login');
});

app.get('/login', (req, res) => {
  res.render('pages/login');
});

app.use((req, res) => {
  res.status(404).json({ status: 404, message: 'Ruta no encontrada', data: null });
});

app.use((error, req, res, next) => {
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      status: 400,
      message: 'El cuerpo de la petición no es un JSON válido',
      data: null,
    });
  }

  console.error('Error no manejado:', error);
  return res.status(500).json({
    status: 500,
    message: 'Error interno del servidor',
    data: null,
  });
});

app.listen(config.port, () => {
  console.log(`Servidor escuchando en el puerto ${config.port}`);
});
