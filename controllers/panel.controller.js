const Cliente = require('../models/cliente.model');
const Trabajador = require('../models/trabajador.model');
const Producto = require('../models/producto.model');
const Pedido = require('../models/pedido.model');

const UMBRAL_STOCK_BAJO = 5;

const obtenerPanel = async (req, res) => {
  try {
    const [
      totalClientes,
      totalTrabajadores,
      totalProductos,
      totalPedidos,
      pedidosPendientesAprobacion,
      productosAgotados,
      productosStockBajo,
      ultimosPedidos,
    ] = await Promise.all([
      Cliente.countDocuments(),
      Trabajador.countDocuments(),
      Producto.countDocuments(),
      Pedido.countDocuments({ activo: true }),
      Pedido.countDocuments({ activo: true, estadoAprobacion: 'Pendiente' }),
      Producto.countDocuments({ stock: 0 }),
      Producto.countDocuments({ stock: { $gt: 0, $lte: UMBRAL_STOCK_BAJO } }),
      Pedido.find({ activo: true })
        .populate('cliente', 'nombre documento')
        .populate('empleadoId', 'nombre cargo')
        .sort({ fechaCreacion: -1, createdAt: -1 })
        .limit(6),
    ]);

    return res.status(200).json({
      status: 200,
      message: 'Panel obtenido correctamente',
      data: {
        totales: {
          clientes: totalClientes,
          trabajadores: totalTrabajadores,
          productos: totalProductos,
          pedidos: totalPedidos,
          pedidosPendientesAprobacion,
          productosAgotados,
          productosStockBajo,
        },
        ultimosPedidos,
      },
    });
  } catch (error) {
    console.error('[panel] Error al obtener los totales:', error.message);
    return res.status(500).json({
      status: 500,
      message: 'Error al obtener el panel',
      data: null,
    });
  }
};

module.exports = { obtenerPanel };
