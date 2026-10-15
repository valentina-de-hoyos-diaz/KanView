const fs = require("fs");

exports.leer = async () => {
    fs.readFile("archivo.log", "utf-8", (err, data) => {
        if (err) {
            console.error(`Error al leer el archivo ${err}`);
            return;
        }

        console.log(data);
    });
};

exports.escribir = async () => {
    await fs.writeFile("archivo.log", "Esto lo puso la maquina", (err) => {
          if (err) {
        console.error(`Error al leer el archivo ${err}`);
    }

    console.log('Log agregado al archivo (Este reemplaza)')
    }
    
)};

exports.crearPedido = async (accion, usuario) => {
    let mensaje = `🔥 ${new Date().toISOString()} - ${accion} - ${usuario}\n - \u{1F600}\n`
    await fs.appendFile('archivo.log', mensaje, err => {
        if (err) {
            console.log(`Error escribiendo log: ${err.message}`);
            return  
        } 

        console.log("Log agregado en el archivo");
    } )
}
