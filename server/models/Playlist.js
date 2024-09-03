const mongoose = require('mongoose')

const PlaylistSchema = new mongoose.Schema({
    name: String,
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    songs: [{
        songId: { type: mongoose.Schema.Types.ObjectId, ref: 'Song'},
        title: String,
        artist: String,
        coverUrl: String,
    }]
})

module.exports = mongoose.model('Playlist', PlaylistSchema)