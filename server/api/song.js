const express = require('express')
const helper = require('../utils/helper')
const services = require('../services')

const router = express.Router()

router.get('/test', async (req, res) => {
    try {
        // const chartData = await helper.getBugsChart()
        // await services.songService.updateChartData(chartData)
        // await services.songService.updateYoutubeUrls()
        res.json('테스투 입니돠')
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

router.get('/stream/:songId', async (req, res) => {
    const { songId } = req.params
    console.log(songId);
    
    const youtubeUrl = await services.songService.getYoutubeUrlbySongId(songId)
    
    // const youtubeUrl = 'https://www.youtube.com/watch?v=hFTs6HbtxbE'
    try {
        const audioStream  = await services.songService.getAudioStream(youtubeUrl)

        res.setHeader('Content-Type', 'audio/mp3')
        res.setHeader('Transfer-Encoding', 'chunked')

        audioStream.pipe(res)
    } catch (err) {
        console.error('오디오 스트림 에러:', err)
        res.status(500).send('오디오 스트림 서버 에러')
    }
})

router.get('/songdata', async (req, res) => {
    const { title, artist } =  req.query
    const songData = await services.songService.getSongByTitleAndArtist(title, artist)
    res.json({ songData })
})

module.exports = router