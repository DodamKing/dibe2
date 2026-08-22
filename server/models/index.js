const mongoose = require('mongoose')

// 서버리스 컨테이너 재사용을 위해 연결 "프로미스"를 캐싱한다.
// 연결 완료된 객체가 아니라 프로미스를 캐싱해야, 콜드 스타트 직후 동시 요청들이
// 각자 mongoose.connect()를 호출하지 않고 하나의 연결에 합류한다.
let connPromise = null

// 연결이 끊기면 캐시를 비워 다음 요청이 재연결하도록 한다.
mongoose.connection.on('disconnected', () => {
    connPromise = null
})

// 프로미스를 그대로 반환한다(내부에 await가 없어 async 불필요). 호출부는 await 하면 된다.
function connectToMongoDB() {
    if (mongoose.connection.readyState === 1) return mongoose.connection

    if (!connPromise) {
        connPromise = mongoose
            .connect(process.env.MONGODB_URI, {
                dbName: 'dibe2',
                maxPoolSize: 1,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 10000,
            })
            .then((m) => {
                console.log('MongoDB 연결됨')
                return m
            })
            .catch((err) => {
                // 다음 요청이 재시도할 수 있게 캐시를 비우고,
                // 반드시 throw 해서 호출자가 즉시 500으로 끊게 한다.
                // (삼키면 연결 없이 라우터로 진입해 쿼리가 버퍼링되며 매달린다)
                connPromise = null
                console.error('MongoDB 연결 실패:', err)
                throw err
            })
    }

    return connPromise
}

const User = require('./User')
const Chart = require('./Chart')
const Song = require('./Song')
const Playlist = require('./Playlist')
const VideoPlaylist = require('./VideoPlaylist')
const Like = require('./Like')
const PlayEvent = require('./PlayEvent')

module.exports = {
    connectToMongoDB,
    User,
    Chart,
    Song,
    Playlist,
    VideoPlaylist,
    Like,
    PlayEvent,
}