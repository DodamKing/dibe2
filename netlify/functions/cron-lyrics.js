require('dotenv').config()

const { schedule } = require('@netlify/functions')
const { connectToMongoDB } = require('../../server/models')
const { songService } = require('../../server/services')
const { sendErrorToSlack } = require('../../server/utils/helper')

// 08:30 KST — 차트 크론(08:00)이 곡을 저장한 뒤에 돈다.
// 예전엔 02:00이었으나 특별한 이유가 없었고, "곡 저장 → 필드 채움" 순서를 지키려고 옮김.
module.exports.handler = schedule('30 23 * * *', async () => {
    console.log('가사 업데이트 시작:', new Date().toISOString())
    try {
        await connectToMongoDB()
        await songService.updateLyrics()
        console.log('가사 업데이트 완료')
        return { statusCode: 200 }
    } catch (err) {
        console.error('가사 업데이트 에러:', err)
        sendErrorToSlack(err, null, { context: 'Cron', jobName: 'updateLyrics' })
        return { statusCode: 500 }
    }
})
