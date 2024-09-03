const mongoose = require('mongoose')

const User = require('./User')
const Chart = require('./Chart')
const Song = require('./Song')
const Playlist = require('./Playlist')

mongoose.connect(process.env.MONGODB_URI, {
    dbName: 'dibe2'
})

mongoose.connection.on('connected', () => {
    console.log('MongoDB에 연결되었습니다.');
});

mongoose.connection.on('error', (err) => {
    console.error('MongoDB 연결 오류:', err);
});

module.exports = {
    User,
    Chart,
    Song,
    Playlist,
}