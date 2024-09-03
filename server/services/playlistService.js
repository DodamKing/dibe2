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
    }
}