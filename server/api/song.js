const express = require('express')
const helper = require('../utils/helper')
const AdvancedInvidiousManager = require('../utils/advancedInvidiousManager')
const services = require('../services')
const { adminMiddleware } = require('../middleware/auth')

const router = express.Router()
const invidious = new AdvancedInvidiousManager()

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
        // const { audioStream, duration, contentLength } = await services.songService.getAudioStream(youtubeUrl)
        const { audioStream, duration, contentLength, mimeType } = await invidious.getAudioStream(youtubeUrl)

        res.setHeader('Content-Type', mimeType)
        res.setHeader('Transfer-Encoding', 'chunked')

        res.setHeader('X-Content-Duration', duration);
        res.setHeader('Content-Length', contentLength);
        res.setHeader('Accept-Ranges', 'bytes');

        audioStream.pipe(res)

        audioStream.on('error', (err) => {
            console.error('Audio stream error:', err.message || 'Unknown error');
            if (!res.headersSent) {
                res.status(500).send('Audio stream error');
            } else {
                res.end();
            }
        });

        res.on('close', () => {
            audioStream.destroy();
        });
    } catch (err) {
        console.error('오디오 스트림 에러:', err)
        res.status(500).send('오디오 스트림 서버 에러')
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