const mongoose = require('mongoose')

let conn = null

async function connectToMongoDB() {
    try {
        if (conn) return 

        conn = await mongoose.connect(process.env.MONGODB_URI,  {
            dbName: 'dibe2',
            maxIdleTimeMS: 30000,  // 최대 유휴 시간
            maxPoolSize: 10, // 연결 풀 크기 제한
            serverSelectionTimeoutMS: 5000, // 서버 선택 타임아웃
            socketTimeoutMS: 45000, // 소켓 타임아웃
        })

        console.log('MongoDB에 성공적으로 연결되었습니다.')

        // 연결 이벤트 리스너 추가
        mongoose.connection.on('disconnected', () => {
            console.log('MongoDB 연결이 끊어졌습니다.')
            conn = null
        })

        mongoose.connection.on('connected', () => {
            console.log('MongoDB에 연결되었습니다.');
        });

        mongoose.connection.on('error', (err) => {
            console.error('MongoDB 연결 오류:', err);
        });

        // 애플리케이션 종료 시 연결 해제
        process.on('SIGINT', async () => {
            if (mongoose.connection.readyState !== 0) { 
                await mongoose.connection.close();
                console.log('MongoDB 연결이 안전하게 종료되었습니다.');
            }
            process.exit(0);
        });

    } catch (err) {
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