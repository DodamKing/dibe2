const express = require('express')
const router = express.Router()

const { themeService } = require('../services')

// GET /api/themes — 활성 테마 목록 (order 순)
router.get('/', async (req, res) => {
    try {
        const themes = await themeService.listThemes()
        res.json({ themes })
    } catch (err) {
        console.error(err)
        res.status(500).json()
    }
})

// GET /api/themes/:key?seed= — 테마 곡 50개. 같은 seed면 같은 목록(응답의 seed를 다시 보내면 재현)
router.get('/:key', async (req, res) => {
    try {
        const playlist = await themeService.getThemePlaylist(req.params.key, req.query.seed)
        if (!playlist) return res.status(404).json({ message: '없는 테마입니다.' })
        res.json(playlist)
    } catch (err) {
        console.error(err)
        res.status(500).json()
    }
})

module.exports = router
