require('dotenv').config()

const { schedule } = require('@netlify/functions')
const { connectToMongoDB } = require('../../server/models')
const { songService } = require('../../server/services')
const { sendErrorToSlack } = require('../../server/utils/helper')

// 08:30 KST — **가사 크론(08:10) 뒤에** 돈다. 가사 크론이 트랙 상세에서 `duration` 을
// 같이 채우고, 매칭이 그 길이로 후보를 고른다(길이 없으면 기존 2~6분 룰).
// 앞으로 당기면 신곡은 길이 없이 검색된다. (2026-08-16에 08:10에서 옮김)
module.exports.handler = schedule('30 23 * * *', async () => {
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
