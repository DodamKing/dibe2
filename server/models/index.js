const mongoose = require('mongoose')

const User = require('./User')
const Chart = require('./Chart')
const Song = require('./Song')
const Playlist = require('./Playlist')

let isConnected = false

const connectDB = async () => {
    if (isConnected) return

    try {
        conn = await mongoose.connect(process.env.MONGODB_URI, {
            dbName: 'dibe2',
        })

        isConnected = true
    } catch (err) {
        console.error('MongoDB 연결 오류:', err)
    }
}

// 연결 이벤트 리스너 추가
mongoose.connection.on('disconnected', () => {
    console.log('MongoDB 연결이 끊어졌습니다. 재연결을 시도합니다.')
    isConnected = false
    // setTimeout(connectDB, 5000) // 5초 후 재연결 시도
})

mongoose.connection.on('connected', () => {
    console.log('MongoDB에 연결되었습니다.');
});

mongoose.connection.on('error', (err) => {
    console.error('MongoDB 연결 오류:', err);
});

module.exports = {
    connectDB,
    User,
    Chart,
    Song,
    Playlist,
}