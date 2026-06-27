const mongoose = require('mongoose')

const VideoPlaylistSchema = new mongoose.Schema({
    name: { type: String, trim: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    videos: [{
        videoId: String,
        title: String,
        thumbnail: String,
        channelTitle: String,
        duration: String,
    }],
    createdAt: { type: Date, default: Date.now }
}, {
    timestamps: true
})

module.exports = mongoose.model('VideoPlaylist', VideoPlaylistSchema)
