const mongoose = require('mongoose')

const PlaylistSchema = new mongoose.Schema({
    name: { type: String, trim: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    songs: [{
        songId: { type: mongoose.Schema.Types.ObjectId, ref: 'Song'},
        title: String,
        artist: String,
        coverUrl: String,
    }],
    createdAt: { type: Date, default: Date.now }
}, {
    timestamps: true
})

module.exports = mongoose.model('Playlist', PlaylistSchema)