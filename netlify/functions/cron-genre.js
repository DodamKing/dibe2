require('dotenv').config()

const { schedule } = require('@netlify/functions')
const { connectToMongoDB } = require('../../server/models')
const { songService } = require('../../server/services')
const { sendErrorToSlack } = require('../../server/utils/helper')

// 08:20 KST — 차트 크론(08:00)이 곡을 저장한 뒤에 돈다.
// 곡 저장과 분리한 이유는 songService.updateGenres 주석 참고.
module.exports.handler = schedule('20 23 * * *', async () => {
    console.log('장르 업데이트 시작:', new Date().toISOString())
    try {
        await connectToMongoDB()
        await songService.updateGenres()
        console.log('장르 업데이트 완료')
        return { statusCode: 200 }
    } catch (err) {
        console.error('장르 업데이트 에러:', err)
        sendErrorToSlack(err, null, { context: 'Cron', jobName: 'updateGenres' })
        return { statusCode: 500 }
    }
})
