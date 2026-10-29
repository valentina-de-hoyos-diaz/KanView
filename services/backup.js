const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const nodemailer = require('nodemailer');

const config = require('../config/env');

const execFileAsync = promisify(execFile);
const DIRECTORIO_BACKUPS = path.join(__dirname, '..', 'backup');

const ocultarCredenciales = (mensaje) =>
  String(mensaje).replace(
    /(mongodb(?:\+srv)?:\/\/[^:/@\s]+:)[^@\s]+@/g,
    '$1***@'
  );

const nombreArchivoBackup = (fecha) =>
  `kanview-${fecha.toISOString().replace(/[:.]/g, '-')}.gz`;

const correoConfigurado = () => {
  const { emailTo, smtp } = config.backup;
  return Boolean(smtp.host && smtp.user && smtp.pass && emailTo);
};

const crearTransportador = () => {
  if (!correoConfigurado()) {
    throw new Error(
      'Configuración de correo incompleta: define SMTP_HOST, SMTP_USER, SMTP_PASS y BACKUP_EMAIL_TO'
    );
  }

  return nodemailer.createTransport({
    host: config.backup.smtp.host,
    port: config.backup.smtp.port,
    secure: config.backup.smtp.secure,
    auth: {
      user: config.backup.smtp.user,
      pass: config.backup.smtp.pass,
    },
    connectionTimeout: 30000,
    greetingTimeout: 30000,
    socketTimeout: 120000,
  });
};

const enviarBackup = async (rutaArchivo, fecha) => {
  const transportador = crearTransportador();
  const { size } = await fs.promises.stat(rutaArchivo);
  const tamanoMb = (size / 1024 / 1024).toFixed(2);

  await transportador.sendMail({
    from: config.backup.smtp.user,
    to: config.backup.emailTo,
    subject: `Backup KanView - ${fecha.toISOString().slice(0, 10)}`,
    text: `Respaldo de la base de datos generado el ${fecha.toISOString()} (${tamanoMb} MB).`,
    attachments: [
      {
        filename: path.basename(rutaArchivo),
        path: rutaArchivo,
      },
    ],
  });
};

exports.correoConfigurado = correoConfigurado;

exports.backupDatabase = async () => {
  if (!correoConfigurado()) {
    throw new Error(
      'No se puede ejecutar el backup: configura SMTP_HOST, SMTP_USER, SMTP_PASS y BACKUP_EMAIL_TO'
    );
  }

  const fecha = new Date();
  const rutaArchivo = path.join(DIRECTORIO_BACKUPS, nombreArchivoBackup(fecha));

  await fs.promises.mkdir(DIRECTORIO_BACKUPS, { recursive: true });

  const argumentos = [
    `--uri=${config.mongodbUri}`,
    `--archive=${rutaArchivo}`,
    '--gzip',
  ];

  if (config.mongodbDb) {
    argumentos.push(`--db=${config.mongodbDb}`);
  }

  try {
    await execFileAsync('mongodump', argumentos, { timeout: 600000 });
  } catch (error) {
    await fs.promises
      .unlink(rutaArchivo)
      .catch((error) =>
        console.warn(`No se pudo eliminar el respaldo incompleto: ${error.message}`)
      );
    const detalle = ocultarCredenciales(error.stderr || error.message);
    throw new Error(`No se pudo generar el respaldo: ${detalle}`);
  }

  try {
    await enviarBackup(rutaArchivo, fecha);
  } catch (error) {
    throw new Error(
      `Respaldo generado en ${rutaArchivo}, pero no se pudo enviar por correo: ${ocultarCredenciales(error.message)}`
    );
  }

  await fs.promises
    .unlink(rutaArchivo)
    .catch((error) =>
      console.warn(`No se pudo eliminar el respaldo temporal: ${error.message}`)
    );

  return {
    archivo: path.basename(rutaArchivo),
    enviadoA: config.backup.emailTo,
  };
};
