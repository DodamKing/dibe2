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
});

// router.post('/:id/songs', playlistController.addSongToPlaylist);
// router.delete('/:id/songs/:songId', playlistController.removeSongFromPlaylist);

module.exports = router