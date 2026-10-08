const SchemaProduct  = require('../models/producto.model')

export const getProducts = async (req, res) => {
    try {
        const products = await SchemaProduct.find()

        if (!products) {
            return res.status(400).json({
                status: 400,
                message: "No hay productos"
            })
        }

        return res.status(200).json({
            "productos": productos
        })

        
    } catch (error) {
        
    }

}

export const createProduct = async (req, res) => {

}

export const updateProduct = async (req, res) => {

}

export const deleteProduct = async (req, res) => {
    
}