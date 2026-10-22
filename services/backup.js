require('dotenv').config();
const cron = require('node-cron');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

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
    console.log(`[${new Date().toLocaleString()}] Iniciando proceso de backup...`);

    // Formateo de fecha único para evitar sobreescritura de archivos
    const fecha = new Date().toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0];
    const fileName = `KanView_${fecha}.archive.gz`;
    const filePath = path.join(__dirname, fileName);

    // Comando mongodump: extrae la base de datos indicada en la URI en un solo binario comprimido
    const dumpCommand = `mongodump --uri="${process.env.MONGODB_URI}" --archive="${filePath}" --gzip`;

    exec(dumpCommand, (error, stdout, stderr) => {
        if (error) {
            console.error('Error al generar el backup de MongoDB:', error.message);
            return;
        }

        console.log('Backup generado exitosamente:', fileName);
        enviarCorreo(filePath, fileName);
    });
};

// Programación de la tarea automática (Todos los días a medianoche 00:00)
cron.schedule('0 0 * * *', () => {
    backupDatabase();
});

// Exportación del módulo para uso modular en index.js si se requiere
module.exports = { backupDatabase };
