const mongoose = require('mongoose')

const chartItemSchema  = new mongoose.Schema({
    rank: Number,
    title: { type: String, trim: true },
    artist: { type: String, trim: true },
    album: { type: String, trim: true },
    coverUrl: { type: String, trim: true },
    detailLink: { type: String, trim: true },
    lyrics: { type: String, trim: true },
    updateAt: Date
})

const chartSchema = new mongoose.Schema({
    lastUpdated: { type: Date, default: Date.now },
    items: [chartItemSchema]
})

chartSchema.pre('findOneAndUpdate', function(next) {
    this.set({ lastUpdated: new Date() })
    next()
})

module.exports = mongoose.model('Chart', chartSchema )