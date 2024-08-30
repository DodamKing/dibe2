const express = require('express')
const helper = require('../utils/helper')

const router = express.Router()

router.get('/test', async (req, res) => {
    try {
        const chartData = await helper.getBugsChart()
        res.json({ chartData })
    } catch (error) {
        console.error('Error crawling Bugs chart:', error);
        res.end()
    }
})

module.exports = router