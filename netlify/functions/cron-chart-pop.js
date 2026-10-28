require('dotenv').config()

const { schedule } = require('@netlify/functions')
const { connectToMongoDB, PopChart } = require('../../server/models')
const helper = require('../../server/utils/helper')
const { songService } = require('../../server/services')
const { sendErrorToSlack } = require('../../server/utils/helper')

// 해외(팝) Top 100. 국내 차트(08:00)와 30초 예산을 나눠 쓰지 않게 **따로** 08:05에 돈다.
// 채움 크론(가사 08:10 / 장르 08:20 / 유튜브 08:30)보다 앞이어야 그날 신곡이 같은 아침에 처리된다.
module.exports.handler = schedule('5 23 * * *', async () => {
    console.log('해외 차트 업데이트 시작:', new Date().toISOString())
    try {
        await connectToMongoDB()
        const chartData = await helper.getBugsChart('day/pop')
        await songService.saveSongData(chartData)
        await songService.markCharted(chartData)
        await songService.updateChartData(chartData, PopChart)
        console.log('해외 차트 업데이트 완료')
        return { statusCode: 200 }
    } catch (err) {
        console.error('해외 차트 업데이트 에러:', err)
        sendErrorToSlack(err, null, { context: 'Cron', jobName: 'updatePopChartData' })
        return { statusCode: 500 }
    }
})
