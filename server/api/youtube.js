const express = require('express')
const services = require('../services')

const router = express.Router()

router.get('/search', async (req, res) => {
    const { query, limit = 20 } = req.query

    if (!query || !query.trim()) {
        return res.status(400).json({ error: '검색어가 필요합니다.', items: [] })
    }

    try {
        const data = await services.songService.searchYoutubeForVideo(query.trim(), parseInt(limit))
        res.json(data)
    } catch (err) {
        console.error('유튜브 비디오 검색 오류:', err)
        res.status(500).json({ error: '검색 중 오류가 발생했습니다.', items: [] })
    }
})

// POST /api/youtube/:videoId/play — 유튜브 영상 재생 1회 기록(테마 곡·영상 페이지, 30초/절반 도달 시)
// body: { title, artist, source: 'theme'|'video', theme }
router.post('/:videoId/play', async (req, res, next) => {
    const { videoId } = req.params
    if (!/^[\w-]{11}$/.test(videoId)) return res.status(400).json({ message: '잘못된 영상 ID입니다.' })
    const { title, artist, source, theme } = req.body || {}
    try {
        res.json(await services.statsService.recordVideoPlay(req.user.userId, {
            videoId, title, artist, source, theme, platform: services.statsService.platformOf(req),
        }))
    } catch (err) {
        next(err)
    }
})

module.exports = router
