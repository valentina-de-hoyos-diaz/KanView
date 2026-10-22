require('dotenv').config();
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// ==========================================================================
// Configuración por variables de entorno
// ==========================================================================

// Zona horaria en la que se programa el backup. Colombia (UTC-5, sin horario de verano).
const BACKUP_TZ = process.env.BACKUP_TZ || 'America/Bogota';

// Expresión cron del backup diario. '0 0 * * *' = todos los días a medianoche.
// El valor 'off' desactiva la programación (útil para ejecuciones puntuales).
const BACKUP_CRON = process.env.BACKUP_CRON || '0 0 * * *';

// Si es 'true', ejecuta un backup y envía el correo al arrancar el servidor.
// Actívalo mientras practicas con nodemon; déjalo en 'false' en producción.
const BACKUP_ON_START = String(process.env.BACKUP_ON_START).toLowerCase() === 'true';

// Ejecución puntual desde terminal: `node services/backup.js --once`
// Un solo respaldo y termina, sin quedar la tarea programada corriendo en segundo plano.
const EJECUCION_PUNTUAL = process.argv.includes('--once');

// Carpeta donde se generan los archivos temporales de respaldo
const BACKUP_DIR = __dirname;

// Evita que dos respaldos se solapen si el servidor se reinicia durante uno en curso
let backupEnCurso = false;

/**
 * Envía el archivo de respaldo generado como archivo adjunto por correo electrónico.
 * @param {string} filePath - Ruta absoluta donde se generó el archivo temporal.
 * @param {string} fileName - Nombre del archivo que verá el destinatario.
 */
const enviarCorreo = async (filePath, fileName) => {
    try {
        // Configuración del servidor SMTP (Gmail) usando variables de entorno
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.MAIL_USER,
                pass: process.env.MAIL_PASS
            }
        });

        console.log('Enviando correo con el respaldo adjunto...');

        // Envío del mensaje
        const info = await transporter.sendMail({
            from: `"Backup Bot" <${process.env.MAIL_USER}>`,
            to: process.env.MAIL_TO,
            subject: `Backup Diario MongoDB: KanView`,
            text: `Adjunto encontrarás el respaldo comprimido de la base de datos KanView.`,
            attachments: [
                {
                    filename: fileName,
                    path: filePath
                }
            ]
        });

        console.log('Correo enviado exitosamente. ID:', info.messageId);

        // Eliminación del archivo comprimido local para evitar saturación de disco
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log('Archivo temporal eliminado del servidor.');
        }

    } catch (error) {
        console.error('Error al enviar el correo:', error);
    }
};

/**
 * Ejecuta el comando mongodump para extraer la base de datos de MongoDB Atlas.
 */
const backupDatabase = () => {
    if (backupEnCurso) {
        console.log('Ya hay un backup en curso, se omite esta ejecución.');
        return;
    }
    backupEnCurso = true;

    console.log(`[${new Date().toLocaleString()}] Iniciando proceso de backup...`);

    // Formateo de fecha único para evitar sobreescritura de archivos
    const fecha = new Date().toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0];
    const fileName = `KanView_${fecha}.archive.gz`;
    const filePath = path.join(BACKUP_DIR, fileName);

    // Comando mongodump: extrae la base de datos indicada en la URI en un solo binario comprimido
    const dumpCommand = `mongodump --uri="${process.env.MONGODB_URI}" --archive="${filePath}" --gzip`;

    exec(dumpCommand, (error, stdout, stderr) => {
        if (error) {
            backupEnCurso = false;
            console.error('Error al generar el backup de MongoDB:', error.message);
            return;
        }

        console.log('Backup generado exitosamente:', fileName);
        enviarCorreo(filePath, fileName).finally(() => {
            backupEnCurso = false;
        });
    });
};

/**
 * Elimina los archivos .archive.gz de ejecuciones anteriores que quedaron a medias
 * (por ejemplo, si el servidor se reinició mientras se generaba el respaldo).
 */
const limpiarRespaldosHuerfanos = () => {
    try {
        const cutoff = Date.now() - 60 * 60 * 1000; // archivos con más de 1 hora
        fs.readdirSync(BACKUP_DIR)
            .filter((n) => n.startsWith('KanView_') && n.endsWith('.archive.gz'))
            .forEach((n) => {
                const p = path.join(BACKUP_DIR, n);
                const stat = fs.statSync(p);
                if (stat.isFile() && stat.mtimeMs < cutoff) {
                    fs.unlinkSync(p);
                    console.log(`Respaldo huérfano eliminado: ${n}`);
                }
            });
    } catch (error) {
        console.error('Error al limpiar respaldos anteriores:', error.message);
    }
};

// ==========================================================================
// Programación de la tarea automática
// ==========================================================================

limpiarRespaldosHuerfanos();

if (EJECUCION_PUNTUAL) {
    console.log('Ejecución puntual (--once): no se programa la tarea periódica.');
} else if (BACKUP_CRON.toLowerCase() !== 'off' && cron.validate(BACKUP_CRON)) {
    const tarea = cron.schedule(BACKUP_CRON, () => {
        backupDatabase();
    }, { timezone: BACKUP_TZ });

    const proxima = tarea.getNextRun();
    console.log(
        `Backup programado: "${BACKUP_CRON}" (zona ${BACKUP_TZ}) | ` +
        `próxima ejecución: ${proxima ? proxima.toLocaleString('es', { timeZone: BACKUP_TZ }) : 'n/d'}`
    );
} else {
    console.log('Programación cron desactivada (BACKUP_CRON=off).');
}

// Envío inmediato al arrancar, útil para ensayar con nodemon
if (EJECUCION_PUNTUAL || BACKUP_ON_START) {
    const motivo = EJECUCION_PUNTUAL ? 'flag --once' : 'BACKUP_ON_START=true';
    console.log(`(${motivo}) enviando un respaldo ahora...`);
    backupDatabase();
}

// Exportación del módulo para uso modular en index.js si se requiere
module.exports = { backupDatabase };
