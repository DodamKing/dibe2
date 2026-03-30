require('dotenv').config()

const { schedule } = require('@netlify/functions')
const { connectToMongoDB } = require('../../server/models')
const { songService } = require('../../server/services')
const { sendErrorToSlack } = require('../../server/utils/helper')

module.exports.handler = schedule('10 23 * * *', async () => {
    console.log('YouTube URL 업데이트 시작:', new Date().toISOString())
    try {
        await connectToMongoDB()
        await songService.updateYoutubeUrls()
        console.log('YouTube URL 업데이트 완료')
        return { statusCode: 200 }
    } catch (err) {
        console.error('YouTube URL 업데이트 에러:', err)
        sendErrorToSlack(err, null, { context: 'Cron', jobName: 'updateYoutubeUrls' })
        return { statusCode: 500 }
    }
})
