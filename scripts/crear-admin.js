const mongoose = require('mongoose');

const config = require('../config/env');
const Usuario = require('../models/usuario.model');
const {
  hashPassword,
  longitudPasswordValida,
  LONGITUD_MINIMA_PASSWORD,
  LONGITUD_MAXIMA_PASSWORD,
} = require('../services/autenticacion.service');

const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || '';
const nombre = (process.env.ADMIN_NOMBRE || 'Administrador').trim();

if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error('Define ADMIN_EMAIL con un correo válido.');
  process.exit(1);
}

if (!longitudPasswordValida(password)) {
  console.error(
    `Define ADMIN_PASSWORD entre ${LONGITUD_MINIMA_PASSWORD} y ${LONGITUD_MAXIMA_PASSWORD} caracteres.`
  );
  process.exit(1);
}

(async () => {
  await mongoose.connect(config.mongodbUri, config.mongodbDb ? { dbName: config.mongodbDb } : {});

  const usuario = await Usuario.findOneAndUpdate(
    { email },
    {
      nombre,
      email,
      password: await hashPassword(password),
      rol: 'admin',
      activo: true,
      debeCambiarPassword: true,
    },
    {
      returnDocument: 'after',
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );

  console.log(`Administrador listo: ${usuario.email} (${usuario._id})`);
  await mongoose.disconnect();
})().catch(async (error) => {
  console.error('No se pudo crear el administrador:', error.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
