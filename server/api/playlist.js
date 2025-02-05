const express = require('express')
const router = express.Router()

const { playlistService } = require('../services')

router.post('/', async (req, res) => {
    try {
        const { name } = req.body
        const userId = req.session.user.userId
        const playlist = await playlistService.createPlaylist(name, userId)

        res.status(201).json({ playlist })
    } catch (err) {
        console.error(err)
        res.status(400).json({ message: err.message })
    }
})

router.get('/', async (req, res) => {
    try {
        const userId = req.session.user.userId
        const playlists = await playlistService.readPlaylists(userId)
        res.json({ playlists })
    } catch (err) {
        console.error(err)
        res.status(500).json()
    }
})

// router.get('/:id', playlistController.getPlaylist);
// router.put('/:id', playlistController.updatePlaylist);

router.delete('/:playlistId', async (req, res) => {
    try {
        const { playlistId } = req.params
        const userId = req.session.user.userId
        const updatedPlaylists = await playlistService.deletePlaylist(playlistId, userId)

        res.json({ updatedPlaylists })
    } catch (err) {
        console.error(err)
        res.status(500).json()
    }
})

router.post('/:id/songs', async (req, res) => {
    const { id } = req.params
    const { songs } = req.body

    try {
        const result = await playlistService.addToPlaylist(id, songs)
        if (!result.success) throw new Error(result.error)
        res.json(result)
    } catch (err) {
        console.error('내 플레이리스트에 노래 추가중 오류 발생: ', err)
        res.status(500).json({ success: false })
    }
})

router.delete('/:id/songs', async (req, res) => {
    const { id } = req.params
    const { songIds } = req.body

    try {
        const result = await playlistService.removeSongsFromPlaylist(id, songIds)
        if (!result.success) throw new Error(result.error)
        res.json(result)
    } catch (err) {
        console.error('플레이리스트에서 노래 제거 중 오류 발생: ', err)
        res.status(500).json({ success: false, error: err })
    }
})

router.get('/:id', async (req, res) => {
    const { id } = req.params

    try {
        const { success, playlist} = await playlistService.readPlaylist(id)
        if (!playlist) return res.status(400).json({ success: false, message: '플레이리스트를 찾을 수 없습니다.'})
        res.json({ success, playlist })
    } catch (err) {
        console.error('플레이리스트 불러오기 api 오류: ', err)
        res.status(500).json({ success: false, error: err })
    }
})

router.put('/:id/name', async (req, res) => {
    const { id } = req.params
    const { name } = req.body

    try {
        const { success, playlist } = await playlistService.rename(id, name)
        res.json({ success, name: playlist.name })
    } catch (err) {
        console.error('플레이리스트 이름 수정 api 오류:', err)
        res.status(500).json({ success: false, error: err })
    }
})

module.exports = router