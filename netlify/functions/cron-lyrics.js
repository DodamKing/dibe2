require('dotenv').config()

const { schedule } = require('@netlify/functions')
const { connectToMongoDB } = require('../../server/models')
const { songService } = require('../../server/services')
const { sendErrorToSlack } = require('../../server/utils/helper')

module.exports.handler = schedule('0 2 * * *', async () => {
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
