const mongoose = require('mongoose')

let conn = null

async function connectToMongoDB() {
    try {
        if (conn && mongoose.connection.readyState === 1) return

        conn = await mongoose.connect(process.env.MONGODB_URI, {
            dbName: 'dibe2',
            maxPoolSize: 1,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 10000,
        })

        console.log('MongoDB 연결됨')
    } catch (err) {
        conn = null
        console.error('MongoDB 연결 실패:', err)
    }
}

const User = require('./User')
const Chart = require('./Chart')
const Song = require('./Song')
const Playlist = require('./Playlist')

module.exports = {
    connectToMongoDB,
    User,
    Chart,
    Song,
    Playlist,
}