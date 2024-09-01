const mongoose = require('mongoose')

const songSchema = new mongoose.Schema({
    title: { type: String, trim: true },
    artist: { type: String, trim: true },
    album: { type: String, trim: true },
    coverUrl: { type: String, trim: true },
    detailLink: { type: String, trim: true },
    lyrics: { type: String, trim: true },
    youtubeUrl : { type: String, trim: true }
})

module.exports = mongoose.model('Song', songSchema )