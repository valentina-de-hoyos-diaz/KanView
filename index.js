const http = require('http');
const path = require('path');
const express = require('express');
const cron = require('node-cron');
const backup = require('./services/backup.js');
const { inicializarMensajeriaWebSocket } = require('./services/mensajeria.websocket');

const config = require('./config/env');
require('./config/connectiondb');

const apiRouter = require('./router/enrutamiento.router');
const {
  cabecerasSeguridad,
  crearCsp,
  sinCacheApi,
  limitarTamanoSolicitud,
  limitarApi,
} = require('./middleware/seguridad');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', config.trustProxy);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(crearCsp());
app.use(cabecerasSeguridad);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', sinCacheApi, limitarTamanoSolicitud, limitarApi, apiRouter);

if (backup.correoConfigurado()) {
  const opcionesCron = config.backup.timezone
    ? { timezone: config.backup.timezone }
    : {};

  cron.schedule(
    '0 0 * * *',
    async () => {
      console.log('Realizando backup de la base de datos...');

      try {
        const resultado = await backup.backupDatabase();
        console.log(
          `Backup enviado a ${resultado.enviadoA} (${resultado.archivo})`
        );
      } catch (error) {
        console.error('Error en el backup automático:', error.message);
      }
    },
    opcionesCron
  );
} else {
  console.error(
    'Backup automático deshabilitado: configura SMTP_HOST, SMTP_USER, SMTP_PASS y BACKUP_EMAIL_TO'
  );
}

app.get('/', (req, res) => {
  res.redirect('/login');
});

app.get('/login', (req, res) => {
  res.render('pages/login');
});

app.get('/dashboard', (req, res) => {
  res.render('pages/dashboard', { titulo: 'Panel' });
});

app.get('/clientes', (req, res) => {
  res.render('pages/clientes', { titulo: 'Clientes' });
});

app.get('/trabajadores', (req, res) => {
  res.render('pages/trabajadores', { titulo: 'Trabajadores' });
});

app.get('/pedidos', (req, res) => {
  res.render('pages/pedidos', { titulo: 'Pedidos' });
});

app.get('/tareas', (req, res) => {
  res.render('pages/tareas', { titulo: 'Tareas' });
});

app.get('/actividades', (req, res) => {
  res.render('pages/actividades', { titulo: 'Actividades' });
});

app.get('/calendario', (req, res) => {
  res.render('pages/calendario', { titulo: 'Calendario' });
});

app.get('/productos', (req, res) => {
  res.render('pages/productos', { titulo: 'Productos' });
});

app.get('/catalogo', (req, res) => {
  res.render('pages/catalogo', { titulo: 'Catálogo' });
});

app.get('/inventario', (req, res) => {
  res.render('pages/inventario', { titulo: 'Inventario' });
});

app.get('/finanzas', (req, res) => {
  res.render('pages/finanzas', { titulo: 'Finanzas' });
});

app.get('/usuarios', (req, res) => {
  res.render('pages/usuarios', { titulo: 'Usuarios' });
});

app.get('/auditoria', (req, res) => {
  res.render('pages/auditoria', { titulo: 'Auditoría' });
});

app.get('/mensajeria', (req, res) => {
  res.render('pages/mensajeria', { titulo: 'Mensajería' });
});

app.get('/portal', (req, res) => {
  res.render('pages/portal', { titulo: 'Portal del Cliente' });
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

const server = http.createServer(app);
inicializarMensajeriaWebSocket(server);

server.listen(config.port, () => {
  console.log(`Servidor escuchando en el puerto ${config.port}`);
});

module.exports = { app, server };
