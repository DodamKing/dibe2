const express = require('express')
const helper = require('../utils/helper')
const services = require('../services')

const router = express.Router()

router.get('/test', async (req, res) => {
    try {
        const chartData = await helper.getBugsChart()
        await services.songService.updateChartData(chartData)
        res.json({ chartData })
    } catch (error) {
        console.error('Error crawling Bugs chart:', error);
        res.end()
    }
})

router.get('/chart', async (req, res) => {
    try {
        const chart = await services.songService.getChartData()
        res.json({ chart })
    } catch (err) {
        console.error('차트 가져오는 엔드포인트 에러', err)
        res.status(500).end()
    }
})

module.exports = router