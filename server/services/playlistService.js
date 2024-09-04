const db = require('../models')

module.exports = {
    createPlaylist: async (name, userId) => {
        try {
            const newPlaylist = new db.Playlist({
                name,
                user: userId,
                songs: []
            })
            await newPlaylist.save()

            return newPlaylist
        } catch (err) {
            console.error(err)
            return err.message
        }
    },

    readPlaylists: async (userId) => {
        try {
            const playlists = db.Playlist.find({ user: userId })
            return playlists
        } catch (err) {
            console.error(err)
        }
    },

    deletePlaylist: async (playlistId, userId) => {
        try {
            await db.Playlist.findByIdAndDelete(playlistId)
            const updatedPlaylists = await db.Playlist.find({ user: userId })
            return updatedPlaylists
        } catch (err) {
            console.error(err)
        }
    }
}