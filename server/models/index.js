const mongoose = require('mongoose')

const User = require('./User')
const Chart = require('./Chart')

mongoose.connect(process.env.MONGODB_URI)

mongoose.connection.on('connected', () => {
    console.log('MongoDB에 연결되었습니다.');
});

mongoose.connection.on('error', (err) => {
    console.error('MongoDB 연결 오류:', err);
});

module.exports = {
    User,
    Chart
}