const fs = require("fs");

/**
 * Lee y muestra el contenido del archivo de logs.
 */
exports.leer = async () => {
    await fs.readFile("archivo.log", "utf-8", (err, data) => {
        if (err) {
            console.error(`Error al leer el archivo ${err}`);
            return;
        }

        console.log(data);
    });
};

/**
 * Agrega una entrada al archivo de logs sin eliminar las anteriores.
 * @param {string} accion - Descripcion de la accion realizada.
 * @param {string} usuario - Usuario que ejecuto la accion.
 */
const agregarEntrada = async (accion, usuario) => {
    const mensaje = `🔥 ${new Date().toISOString()} - ${accion} - ${usuario}\n - \u{1F600}\n`;

    await fs.appendFile('archivo.log', mensaje, (err) => {
        if (err) {
            console.log(`Error escribiendo log: ${err.message}`);
            return;
        }

        console.log("Log agregado en el archivo");
    });
};

/**
 * Escribe una entrada en el archivo de logs (agrega, no reemplaza).
 * @param {string} accion - Descripcion de la accion realizada.
 * @param {string} usuario - Usuario que ejecuto la accion.
 */
exports.escribir = async (accion, usuario) => {
    await agregarEntrada(accion, usuario);
};

/**
 * Registra la creacion de un pedido en el archivo de logs.
 * @param {string} accion - Descripcion de la accion realizada.
 * @param {string} usuario - Usuario que ejecuto la accion.
 */
exports.crearPedido = async (accion, usuario) => {
    await agregarEntrada(accion, usuario);
};

/**
 * Alias historico que agrega la entrada sin reemplazar el archivo.
 * @param {string} accion - Descripcion de la accion realizada.
 * @param {string} usuario - Usuario que ejecuto la accion.
 */
exports.escribir_sin_reemplazar = async (accion, usuario) => {
    await agregarEntrada(accion, usuario);
};
