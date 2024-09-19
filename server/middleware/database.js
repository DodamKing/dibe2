// serverMiddleware/database.js
const mongoose = require('mongoose');

let connection = null;

const connectToDatabase = async () => {
    if (connection && mongoose.connection.readyState === 1) {
        return;
    }

    try {
        connection = await mongoose.connect(process.env.MONGODB_URI, {
            dbName: 'dibe2',
            maxPoolSize: 10,
            minPoolSize: 5,   // 최소 연결 수 설정
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });
        console.log('MongoDB에 연결되었습니다.');

        mongoose.connection.on('disconnected', () => {
            console.log('MongoDB 연결이 끊어졌습니다.');
            connection = null;
        });

    } catch (error) {
        console.error('MongoDB 연결 오류:', error);
        connection = null;
        throw error;
    }
};

// 애플리케이션 종료 시 연결 해제
process.on('SIGINT', async () => {
    if (mongoose.connection.readyState === 1) { 
        await mongoose.connection.close();
        console.log('MongoDB 연결이 안전하게 종료되었습니다.');
    }
    process.exit(0);
});

export default async function (req, res, next) {
    try {
        await connectToDatabase();
        next();
    } catch (error) {
        console.error('데이터베이스 연결 오류:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
}
