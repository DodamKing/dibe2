// modules/db-connection.js
const { connectToMongoDB } = require('../server/models')

module.exports = function () {
    // Nuxt 훅을 사용하여 서버 시작 시 실행
    this.nuxt.hook('ready', async nuxt => {
        try {
            await connectToMongoDB()
        } catch (error) {
            console.error('MongoDB 연결 실패:', error)
            // 필요하다면 여기서 프로세스를 종료하거나 다른 에러 처리를 할 수 있습니다.
            // process.exit(1)
        }
    })
}