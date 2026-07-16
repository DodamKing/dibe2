const express = require('express')
const mongoose = require('mongoose')
const helper = require('../utils/helper')
const services = require('../services')
const { adminMiddleware } = require('../middleware/auth')

const router = express.Router()

// 잘못된 형식의 id를 그냥 넘기면 Mongoose CastError → 500 → 슬랙 알림까지 울린다.
// 클라이언트 잘못은 400으로 끊는다.
function validSongId(req, res) {
    if (mongoose.Types.ObjectId.isValid(req.params.id)) return true
    res.status(400).json({ message: '잘못된 곡 id 입니다.' })
    return false
}

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

router.get('/songdata', async (req, res) => {
    const { title, artist } = req.query
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

router.get('/youtubeId/:songId', async (req, res, next) => {
    const { songId } = req.params

    try {
        const youtubeId = await services.songService.getYoutubeId(songId)
        res.json(youtubeId)
    } catch (err) {
        next(err)
    }
})

router.post('/by-ids', async (req, res) => {
    const { ids } = req.body
    if (!Array.isArray(ids) || ids.length === 0) return res.json({ songs: [] })

    const songs = await services.songService.getSongsByIds(ids)
    // 목록에 하트 상태를 그리려면 곡마다 liked가 필요하다. Like 쿼리 1회로 붙인다.
    const withFlags = await services.statsService.attachLikedFlags(req.user?.userId, songs)
    res.json({ songs: withFlags })
})

// ── 좋아요 / 재생수 ───────────────────────────────────────────────
// 주의: '/liked'는 '/:id' 형태 라우트보다 먼저 선언해야 param으로 먹히지 않는다.

// GET /api/songs/liked — 내가 좋아요한 곡(최신순)
router.get('/liked', async (req, res, next) => {
    const { page = 1, limit = 50 } = req.query

    try {
        const result = await services.statsService.getLikedSongs(
            req.user.userId,
            parseInt(page),
            Math.min(parseInt(limit), 100)
        )
        res.json(result)
    } catch (err) {
        next(err)
    }
})

// POST /api/songs/:id/like — 좋아요 등록(멱등)
router.post('/:id/like', async (req, res, next) => {
    if (!validSongId(req, res)) return

    try {
        const result = await services.statsService.like(req.user.userId, req.params.id)
        if (!result) return res.status(404).json({ message: '곡을 찾을 수 없습니다.' })
        res.json(result)
    } catch (err) {
        next(err)
    }
})

// DELETE /api/songs/:id/like — 좋아요 해제(멱등)
router.delete('/:id/like', async (req, res, next) => {
    if (!validSongId(req, res)) return

    try {
        const result = await services.statsService.unlike(req.user.userId, req.params.id)
        if (!result) return res.status(404).json({ message: '곡을 찾을 수 없습니다.' })
        res.json(result)
    } catch (err) {
        next(err)
    }
})

// POST /api/songs/:id/play — 재생 1회 기록(앱이 30초/50% 도달 시 호출)
router.post('/:id/play', async (req, res, next) => {
    if (!validSongId(req, res)) return
    const { source } = req.body || {}

    try {
        const result = await services.statsService.recordPlay(req.user.userId, req.params.id, source)
        if (!result) return res.status(404).json({ message: '곡을 찾을 수 없습니다.' })
        res.json(result)
    } catch (err) {
        next(err)
    }
})

// 가사가 비어 있으면 여기서 즉석으로 채운다(lazy fill). 응답의 adult 는
// "가사 없음"과 "19금이라 제공 안 됨"을 UI가 구분해서 보여주기 위한 것.
router.get('/lyrics/:songId', async (req, res, next) => {
    try {
        const { lyrics, adult } = await services.songService.getLyrics(req.params.songId)
        res.json({ lyrics, adult })
    } catch (err) {
        next(err)
    }
})

router.post('/', async (req, res) => {
    const song = req.body

    try {
        const result = await services.songService.addSong(song)
        res.json(result)
    } catch (error) {
        console.error('음원 추가 중 오류 발생', error)
        res.status(500).json({ message: '서버 오류로 음원 추가에 실패했습니다.' })
    }
})

router.put('/:id', adminMiddleware, async (req, res) => {
    const songId = req.params.id

    try {
        const result = await services.songService.updateSong(songId, req.body)
        res.json(result);
    } catch (error) {
        console.error('라우터에서 음원 수정 처리 중 오류 발생:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
})

router.get('/search-bugs', async (req, res) => {
    const { query } = req.query

    try {
        const results = await helper.searchBugsMusic(query);
        res.json({ results });
    } catch (error) {
        console.error('Bugs 검색 중 오류:', error);
        res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
    }
})

router.get('/search-youtube', async (req, res) => {
    try {
        const { query } = req.query;
        if (!query) {
            return res.status(400).json({
                success: false,
                message: '검색어가 필요합니다.',
                results: []
            })
        }

        const response = await services.songService.getYoutubeUrlsByYouTubeSearch(query);
        res.json(response);

    } catch (error) {
        console.error('YouTube 검색 오류:', error)
        res.status(500).json({
            success: false,
            message: 'YouTube 검색 중 오류가 발생했습니다.',
            results: []
        })
    }
})

router.delete('/delete/:id', async (req, res) => {
    try {
        const result = await services.songService.delete(req.params.id)

        if (!result) {
            return res.status(404).json({
                success: false,
                message: '해당하는 음원을 찾을 수 없습니다.'
            })
        }
        
        res.json({ success: true, message: '음원이 성공적으로 삭제되었습니다.' })
    } catch (error) {
        console.error('음원 삭제 중 오류 발생:', error)
        res.status(500).json({ success: false, message: '음원 삭제 중 오류가 발생했습니다.' })
    }
})

module.exports = router