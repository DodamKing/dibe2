const mongoose = require('mongoose')

const User = require('./User')

mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})

mongoose.connection.on('connected', () => {
    console.log('MongoDB에 연결되었습니다.');
});

mongoose.connection.on('error', (err) => {
    console.error('MongoDB 연결 오류:', err);
});

module.exports = {
    User,
}