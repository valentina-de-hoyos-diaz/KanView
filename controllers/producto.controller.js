const SchemaProduct  = require('../models/producto.model')

export const getProducts = async (req, res) => {
    const products = await SchemaProduct.find()

}

export const createProduct = async (req, res) => {

}

export const updateProduct = async (req, res) => {

}

export const deleteProduct = async (req, res) => {
    
}