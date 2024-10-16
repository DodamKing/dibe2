// server/middleware/dbConnection.js
const { connectToMongoDB } = require('../models')

try {
    connectToMongoDB()
} catch (error) {
    console.error('MongoDB 연결 실패:', error)
}

module.exports = async function (req, res, next) {
    next()
}