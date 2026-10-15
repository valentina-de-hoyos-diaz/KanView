const mongoose = require("mongoose");
const Pedido = require("../models/pedido.model");
const Cliente = require("../models/cliente.model");
const Producto = require("../models/producto.model");
const logger = require("../middleware/logs");
const { isValidObjectId } = mongoose;

const esSesionCliente = req => Boolean(req.sesion && req.sesion.tipoUsuario === "Cliente");

const generarCodigoPedido = () => `OR-${Math.floor(100000 + Math.random() * 900000)}`;

const ESTADOS_PEDIDO = Pedido.schema.path("estadoPedido").enumValues;

const tieneProducto = producto =>
    Boolean(producto) &&
    ((typeof producto.codigo === "string" && producto.codigo.trim().length > 0) ||
        (typeof producto.nombre === "string" && producto.nombre.trim().length > 0));

const resolverProductoCatalogo = async (producto = {}) => {
    const codigo = typeof producto.codigo === "string" ? producto.codigo.trim() : "";
    const nombre = typeof producto.nombre === "string" ? producto.nombre.trim() : "";

    if (codigo) {
        const porCodigo = await Producto.findOne({ codigoProducto: codigo });

        if (porCodigo) {
            return porCodigo;
        }
    }

    if (nombre) {
        return Producto.findOne({ nombre });
    }

    return null;
};

const precioUnitarioDeCatalogo = productoCatalogo => Number(productoCatalogo.precio.toString());

const getPedidos = async (req, res) => {
    try {
        const filtro = esSesionCliente(req) ? { cliente: req.usuario._id } : {};

        const pedidos = await Pedido.find(filtro)
            .populate("cliente")
            .populate("empleadoId")
            .populate("usuarioCreador")
            .sort({ fechaCreacion: -1 });

        res.status(200).json({
            status: 200,
            message: "Pedidos obtenidos correctamente",
            data: pedidos,
        });
    } catch (error) {
        res.status(500).json({
            status: 500,
            message: "Error al obtener los pedidos",
            data: { error: error.message },
        });
    }
};

const getPedidoById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidObjectId(id)) {
            return res.status(400).json({
                status: 400,
                message: "El ID proporcionado no es válido",
                data: null,
            });
        }

        const filtro = esSesionCliente(req) ? { _id: id, cliente: req.usuario._id } : { _id: id };

        const pedido = await Pedido.findOne(filtro)
            .populate("cliente")
            .populate("empleadoId")
            .populate("usuarioCreador");

        if (!pedido) {
            return res.status(404).json({
                status: 404,
                message: "Pedido no encontrado",
                data: null,
            });
        }

        res.status(200).json({
            status: 200,
            message: "Pedido obtenido correctamente",
            data: pedido,
        });
    } catch (error) {
        res.status(500).json({
            status: 500,
            message: "Error al obtener el pedido",
            data: { error: error.message },
        });
    }
};

const crearPedidoDeCliente = async (req, res) => {
    try {
        const { descripcion, producto } = req.body || {};

        if (typeof descripcion !== "string" || descripcion.trim().length === 0) {
            return res.status(400).json({
                status: 400,
                message: "La descripción del pedido es obligatoria",
                data: null,
            });
        }

        if (!tieneProducto(producto)) {
            return res.status(400).json({
                status: 400,
                message: "El producto es obligatorio",
                data: null,
            });
        }

        const productoCatalogo = await resolverProductoCatalogo(producto);

        if (!productoCatalogo) {
            return res.status(400).json({
                status: 400,
                message: "El producto seleccionado no existe en el catálogo",
                data: null,
            });
        }

        const cantidad = Number(producto.cantidad);
        const ahora = new Date();

        const nuevoPedido = new Pedido({
            codigoPedido: generarCodigoPedido(),
            descripcion: descripcion.trim(),
            cliente: req.usuario._id,
            estadoPedido: "Pendiente",
            fechaCreacion: ahora,
            horaCreacion: ahora.toTimeString().slice(0, 5),
            usuarioCreador: req.usuario._id,
            tipoUsuarioCreador: "Cliente",
            producto: {
                nombre: productoCatalogo.nombre,
                codigo: productoCatalogo.codigoProducto,
                descripcion: descripcion.trim(),
                cantidad: Number.isFinite(cantidad) && cantidad > 0 ? cantidad : 1,
                precio: precioUnitarioDeCatalogo(productoCatalogo),
                fecha_registro: ahora,
            },
        });

        const pedidoGuardado = await nuevoPedido.save();
        await pedidoGuardado.populate("cliente");

        await logger.crearPedido(
            `creo el pedido ${pedidoGuardado.codigoPedido}`,
            `Cliente: ${pedidoGuardado.cliente.nombre} (${pedidoGuardado.cliente.documento})`,
        );

        return res.status(201).json({
            status: 201,
            message: "Pedido creado correctamente",
            data: pedidoGuardado,
        });
    } catch (error) {
        if (error instanceof mongoose.Error.ValidationError) {
            return res.status(400).json({
                status: 400,
                message: "Error de validación",
                data: { error: error.message },
            });
        }

        return res.status(500).json({
            status: 500,
            message: "Error al crear el pedido",
            data: { error: error.message },
        });
    }
};

const createPedido = async (req, res) => {
    try {
        if (!req.usuario) {
            return res.status(401).json({
                status: 401,
                message: "Se requiere un usuario autenticado para crear el pedido",
                data: null,
            });
        }

        if (esSesionCliente(req)) {
            return crearPedidoDeCliente(req, res);
        }

        const {
            codigoPedido,
            descripcion,
            cliente,
            empleadoId,
            estadoPedido,
            evidencia,
            fechaCreacion,
            horaCreacion,
            factura,
            producto,
        } = req.body || {};

        if (!isValidObjectId(cliente)) {
            return res.status(400).json({
                status: 400,
                message: "El campo cliente no es un ObjectId válido",
                data: null,
            });
        }

        const clienteExiste = await Cliente.exists({ _id: cliente });

        if (!clienteExiste) {
            return res.status(400).json({
                status: 400,
                message: "El cliente indicado no existe",
                data: null,
            });
        }

        if (empleadoId !== undefined && empleadoId !== null && !isValidObjectId(empleadoId)) {
            return res.status(400).json({
                status: 400,
                message: "El campo empleadoId no es un ObjectId válido",
                data: null,
            });
        }

        if (estadoPedido !== undefined && !ESTADOS_PEDIDO.includes(estadoPedido)) {
            return res.status(400).json({
                status: 400,
                message: `estadoPedido debe ser uno de: ${ESTADOS_PEDIDO.join(", ")}`,
                data: null,
            });
        }

        if (typeof descripcion !== "string" || descripcion.trim().length === 0) {
            return res.status(400).json({
                status: 400,
                message: "La descripción del pedido es obligatoria",
                data: null,
            });
        }

        if (!tieneProducto(producto)) {
            return res.status(400).json({
                status: 400,
                message: "El producto es obligatorio",
                data: null,
            });
        }

        const productoCatalogo = await resolverProductoCatalogo(producto);

        if (!productoCatalogo) {
            return res.status(400).json({
                status: 400,
                message: "El producto seleccionado no existe en el catálogo",
                data: null,
            });
        }

        const ahora = new Date();

        let fechaCreacionDate = ahora;
        if (fechaCreacion !== undefined && fechaCreacion !== null && fechaCreacion !== "") {
            fechaCreacionDate = new Date(fechaCreacion);

            if (isNaN(fechaCreacionDate.getTime())) {
                return res.status(400).json({
                    status: 400,
                    message: "fechaCreacion no es una fecha válida",
                    data: null,
                });
            }
        }

        const cantidad = Number(producto.cantidad);
        const codigoNormalizado =
            codigoPedido !== undefined && codigoPedido !== null ? String(codigoPedido).trim() : "";

        const nuevoPedido = new Pedido({
            codigoPedido: codigoNormalizado || generarCodigoPedido(),
            descripcion: descripcion.trim(),
            cliente,
            empleadoId: empleadoId || undefined,
            estadoPedido: estadoPedido || "Pendiente",
            evidencia,
            fechaCreacion: fechaCreacionDate,
            horaCreacion: horaCreacion || ahora.toTimeString().slice(0, 5),
            factura,
            producto: {
                nombre: productoCatalogo.nombre,
                codigo: productoCatalogo.codigoProducto,
                descripcion:
                    typeof producto.descripcion === "string" && producto.descripcion.trim().length > 0
                        ? producto.descripcion.trim()
                        : descripcion.trim(),
                cantidad: Number.isFinite(cantidad) && cantidad > 0 ? cantidad : 1,
                precio: precioUnitarioDeCatalogo(productoCatalogo),
                fecha_registro: ahora,
            },
            usuarioCreador: req.usuario._id,
            tipoUsuarioCreador: "Usuario",
        });

        const pedidoGuardado = await nuevoPedido.save();
        await pedidoGuardado.populate("cliente");
        await pedidoGuardado.populate("empleadoId");
        await pedidoGuardado.populate("usuarioCreador");

        await logger.crearPedido(
            `creo el pedido ${pedidoGuardado.codigoPedido}`,
            `Cliente: ${pedidoGuardado.cliente.nombre} (${pedidoGuardado.cliente.documento})`,
        );

        res.status(201).json({
            status: 201,
            message: "Pedido creado correctamente",
            data: pedidoGuardado,
        });
    } catch (error) {
        if (error instanceof mongoose.Error.ValidationError) {
            return res.status(400).json({
                status: 400,
                message: "Error de validación",
                data: { error: error.message },
            });
        }

        res.status(500).json({
            status: 500,
            message: "Error al crear el pedido",
            data: { error: error.message },
        });
    }
};

const updatePedido = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidObjectId(id)) {
            return res.status(400).json({
                status: 400,
                message: "El ID proporcionado no es válido",
                data: null,
            });
        }

        const datos = { ...req.body };
        delete datos.usuarioCreador;

        if (datos.cliente !== undefined && !isValidObjectId(datos.cliente)) {
            return res.status(400).json({
                status: 400,
                message: "El campo cliente no es un ObjectId válido",
                data: null,
            });
        }

        if (datos.empleadoId !== undefined && !isValidObjectId(datos.empleadoId)) {
            return res.status(400).json({
                status: 400,
                message: "El campo empleadoId no es un ObjectId válido",
                data: null,
            });
        }

        if (datos.fechaCreacion !== undefined) {
            const fecha = new Date(datos.fechaCreacion);
            if (isNaN(fecha.getTime())) {
                return res.status(400).json({
                    status: 400,
                    message: "fechaCreacion no es una fecha válida",
                    data: null,
                });
            }
            datos.fechaCreacion = fecha;
        }

        const pedidoActualizado = await Pedido.findByIdAndUpdate(id, datos, {
            new: true,
            runValidators: true,
        })
            .populate("cliente")
            .populate("empleadoId")
            .populate("usuarioCreador");

        if (!pedidoActualizado) {
            return res.status(404).json({
                status: 404,
                message: "Pedido no encontrado",
                data: null,
            });
        }

        res.status(200).json({
            status: 200,
            message: "Pedido actualizado correctamente",
            data: pedidoActualizado,
        });
    } catch (error) {
        if (error instanceof mongoose.Error.ValidationError) {
            return res.status(400).json({
                status: 400,
                message: "Error de validación",
                data: { error: error.message },
            });
        }

        res.status(500).json({
            status: 500,
            message: "Error al actualizar el pedido",
            data: { error: error.message },
        });
    }
};

const deletePedido = async (req, res) => {
    try {
        const { id } = req.params;

        if (!isValidObjectId(id)) {
            return res.status(400).json({
                status: 400,
                message: "El ID proporcionado no es válido",
                data: null,
            });
        }

        const pedidoEliminado = await Pedido.findByIdAndDelete(id);

        if (!pedidoEliminado) {
            return res.status(404).json({
                status: 404,
                message: "Pedido no encontrado",
                data: null,
            });
        }

        res.status(200).json({
            status: 200,
            message: "Pedido eliminado correctamente",
            data: pedidoEliminado,
        });
    } catch (error) {
        res.status(500).json({
            status: 500,
            message: "Error al eliminar el pedido",
            data: { error: error.message },
        });
    }
};

module.exports = {
    getPedidos,
    getPedidoById,
    createPedido,
    updatePedido,
    deletePedido,
};
