require('dotenv').config();
require('./config/connectiondb');

const path = require('path')
const express = require('express');
const app = express();
const enrutamiento = require('./router/enrutamiento.router');

app.use(express.json());
app.use('/api/v1', enrutamiento);

app.listen(process.env.PORT || 3000, () => {
  console.log(`Servidor escuchando en el puerto ${process.env.PORT || 3000}`);
}); 
