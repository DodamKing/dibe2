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

module.exports = router
