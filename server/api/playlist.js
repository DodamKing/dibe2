const express = require('express')
const router = express.Router()

const { playlistService } = require('../services')

router.post('/', async (req, res) => {
    try {
        const { name } = req.body
        const userId = req.user.userId
        const playlist = await playlistService.createPlaylist(name, userId)

        res.status(201).json({ playlist })
    } catch (err) {
        res.status(400).json({ message: err.message })
    }
})

router.get('/', async (req, res) => {
    const playlists = [
        { _id: 1, name: '드라이브 뮤직', cover: 'https://via.placeholder.com/200x200' },
        { _id: 2, name: 'Chill Vibes', cover: 'https://via.placeholder.com/200x200' },
        { _id: 3, name: '운동할 때', cover: 'https://via.placeholder.com/200x200' },
        { _id: 4, name: 'K-Pop Hits', cover: 'https://via.placeholder.com/200x200' },
    ]
    res.json({ playlists })
})

// router.get('/:id', playlistController.getPlaylist);
// router.put('/:id', playlistController.updatePlaylist);
// router.delete('/:id', playlistController.deletePlaylist);

// router.post('/:id/songs', playlistController.addSongToPlaylist);
// router.delete('/:id/songs/:songId', playlistController.removeSongFromPlaylist);

module.exports = router