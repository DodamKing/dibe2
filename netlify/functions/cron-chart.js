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
        await songService.updateChartData(chartData)
        console.log('차트 업데이트 완료')
        return { statusCode: 200 }
    } catch (err) {
        console.error('차트 업데이트 에러:', err)
        sendErrorToSlack(err, null, { context: 'Cron', jobName: 'updateChartData' })
        return { statusCode: 500 }
    }
})
