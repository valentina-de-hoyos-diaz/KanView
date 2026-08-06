require('dotenv').config();
const express = require('express');
const app = express();
require('./config/connectiondb');
const trabajadorRouter = require('./router/trabajador.router');

app.use(express.json());
app.use('/api/trabajadores', trabajadorRouter);

app.listen(process.env.PORT || 3000, () => {
  console.log(`Servidor escuchando en el puerto ${process.env.PORT || 3000}`);
}); 
