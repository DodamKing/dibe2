require('dotenv').config()

const { schedule } = require('@netlify/functions')
const { connectToMongoDB } = require('../../server/models')
const helper = require('../../server/utils/helper')
const { songService } = require('../../server/services')
const { sendErrorToSlack } = require('../../server/utils/helper')

module.exports.handler = schedule('0 23 * * *', async () => {
    console.log('차트 업데이트 시작:', new Date().toISOString())
    try {
        await connectToMongoDB()
        const chartData = await helper.getBugsChart()
        await songService.saveSongData(chartData)
        // saveSongData 다음에 부를 것 — 신곡도 등장 기록에 포함되어야 한다.
        // 이 기록이 뒤따르는 크론(유튜브 08:10 / 장르 08:20 / 가사 08:30)의 처리 순서를 정한다.
        await songService.markCharted(chartData)
        await songService.updateChartData(chartData)
        console.log('차트 업데이트 완료')
        return { statusCode: 200 }
    } catch (err) {
        console.error('차트 업데이트 에러:', err)
        sendErrorToSlack(err, null, { context: 'Cron', jobName: 'updateChartData' })
        return { statusCode: 500 }
    }
})
