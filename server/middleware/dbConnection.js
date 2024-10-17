// server/middleware/dbConnection.js
const { connectToMongoDB } = require('../models')

let isConnected = false

module.exports = async function (req, res, next) {
    try {
        if (!isConnected) await connectToMongoDB()
        next()
    } catch (error) {
        console.error('MongoDB 연결 실패:', error)
        return res.status(500).json({ error: 'Database connection error' })
    }
}