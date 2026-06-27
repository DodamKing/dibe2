const express = require('express')
const router = express.Router()

const { videoPlaylistService } = require('../services')

router.post('/', async (req, res) => {
    try {
        const { name } = req.body
        const userId = req.user.userId
        const playlist = await videoPlaylistService.createPlaylist(name, userId)

        res.status(201).json({ playlist })
    } catch (err) {
        console.error(err)
        res.status(400).json({ message: err.message })
    }
})

router.get('/', async (req, res) => {
    try {
        const userId = req.user.userId
        const playlists = await videoPlaylistService.readPlaylists(userId)
        res.json({ playlists })
    } catch (err) {
        console.error(err)
        res.status(500).json()
    }
})

router.delete('/:playlistId', async (req, res) => {
    try {
        const { playlistId } = req.params
        const userId = req.user.userId
        const updatedPlaylists = await videoPlaylistService.deletePlaylist(playlistId, userId)

        res.json({ updatedPlaylists })
    } catch (err) {
        console.error(err)
        res.status(500).json()
    }
})

router.post('/:id/videos', async (req, res) => {
    const { id } = req.params
    const { videos } = req.body

    try {
        const result = await videoPlaylistService.addToPlaylist(id, videos)
        if (!result.success) throw new Error(result.error)
        res.json(result)
    } catch (err) {
        console.error('내 비디오 플레이리스트에 영상 추가중 오류 발생: ', err)
        res.status(500).json({ success: false })
    }
})

router.delete('/:id/videos', async (req, res) => {
    const { id } = req.params
    const { videoIds } = req.body

    try {
        const result = await videoPlaylistService.removeVideosFromPlaylist(id, videoIds)
        if (!result.success) throw new Error(result.error)
        res.json(result)
    } catch (err) {
        console.error('비디오 플레이리스트에서 영상 제거 중 오류 발생: ', err)
        res.status(500).json({ success: false, error: err })
    }
})

router.get('/:id', async (req, res) => {
    const { id } = req.params

    try {
        const { success, playlist } = await videoPlaylistService.readPlaylist(id)
        if (!playlist) return res.status(400).json({ success: false, message: '플레이리스트를 찾을 수 없습니다.' })
        res.json({ success, playlist })
    } catch (err) {
        console.error('비디오 플레이리스트 불러오기 api 오류: ', err)
        res.status(500).json({ success: false, error: err })
    }
})

router.put('/:id/name', async (req, res) => {
    const { id } = req.params
    const { name } = req.body

    try {
        const { success, playlist } = await videoPlaylistService.rename(id, name)
        res.json({ success, name: playlist.name })
    } catch (err) {
        console.error('비디오 플레이리스트 이름 수정 api 오류:', err)
        res.status(500).json({ success: false, error: err })
    }
})

module.exports = router
