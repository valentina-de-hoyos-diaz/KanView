const path = require('path');
const express = require('express');

const config = require('./config/env');
require('./config/connectiondb');

const autenticacionRouter = require('./router/autenticacion.router');
const trabajadorRouter = require('./router/trabajador.router');
const clienteRouter = require('./router/cliente.router');
const pedidoRouter = require('./router/pedido.router');
const productoRouter = require('./router/producto.router');
const { createTrabajador } = require('./controllers/trabajador.controller');
const { authenticate, requireUsuario } = require('./middleware/autenticacion.middleware');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', autenticacionRouter);
// Registro de trabajador sin sesión: el POST es público, el resto de /api/trabajadores queda protegido
app.post('/api/trabajadores', createTrabajador);
app.use('/api/trabajadores', authenticate, requireUsuario, trabajadorRouter);
app.use('/api/clientes', authenticate, requireUsuario, clienteRouter);
app.use('/api/pedidos', authenticate, pedidoRouter);
app.use('/api/productos', authenticate, productoRouter);

app.get('/', (req, res) => {
  res.redirect('/login');
});

app.get('/login', (req, res) => {
  res.render('pages/login');
});

app.get('/clientes', (req, res) => {
  res.render('pages/clientes', { titulo: 'Clientes' });
});

app.get('/pedidos', (req, res) => {
  res.render('pages/pedidos', { titulo: 'Pedidos' });
});

app.get('/productos', (req, res) => {
  res.render('pages/productos', { titulo: 'Productos' });
});

app.get('/portal', (req, res) => {
  res.render('pages/portal', { titulo: 'Portal del Cliente' });
});

// Vista pública de registro de trabajador (el POST se resuelve en /api/trabajadores)
app.get('/trabajadores/registro', (req, res) => {
  res.render('pages/registro-trabajador');
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
