const express = require('express')
const helper = require('../utils/helper')
const services = require('../services')

const router = express.Router()

router.get('/test', async (req, res) => {
    try {
        const detailLink = await helper.getBugsDetailUrl('녹아내려요 day6')
        res.json(detailLink)
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
    let youtubeUrl = await services.songService.getYoutubeUrlbySongId(songId)
    if (!youtubeUrl) youtubeUrl = await services.songService.updateYoutubeUrl(songId)
    
    try {
        // const audioStream  = await services.songService.getAudioStream(youtubeUrl)
        const { audioStream, duration, contentLength } = await services.songService.getAudioStream(youtubeUrl)

        res.setHeader('Content-Type', 'audio/mp3')
        res.setHeader('Transfer-Encoding', 'chunked')

        res.setHeader('X-Content-Duration', duration);
        res.setHeader('Content-Length', contentLength);
        res.setHeader('Accept-Ranges', 'bytes');

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

router.post('/songsdata', async (req, res) => {
    const { songs } = req.body
    const songDatas = []
    for (const song of songs) {
        const songData = await services.songService.getSongByTitleAndArtist(song.title, song.artist)
        songDatas.push(songData)
    }
    res.json({ songDatas })
}),

router.get('/search', async (req, res) => {
    const { query, type = 'all', page = 1, limit = 20 } = req.query

    try {
        const results = await services.songService.searchSong(query, type, parseInt(page), parseInt(limit))
        res.json(results)
    } catch (err) {
        console.error('곡 검색 api 에러 :', err)
        res.status(500).json({ error: '검색 중 에러 발생' })
    }
})

module.exports = router