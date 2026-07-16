const mongoose = require('mongoose')

const songSchema = new mongoose.Schema({
    title: { type: String, trim: true },
    artist: { type: String, trim: true },
    album: { type: String, trim: true },
    coverUrl: { type: String, trim: true },
    detailLink: { type: String, trim: true },
    lyrics: { type: String, trim: true },
    youtubeUrl : { type: String, trim: true },
    // 벅스는 장르를 트랙이 아니라 앨범에 붙인다. 같은 앨범 곡은 값이 같다.
    genre: { type: [String], default: undefined },
    style: { type: [String], default: undefined },
    // 집계 캐시. 원본은 Like / PlayEvent 컬렉션이고 여기 값은 $inc로 함께 갱신한다.
    // 목록 응답마다 count 쿼리를 도는 걸 피하려는 비정규화.
    likeCount: { type: Number, default: 0, min: 0 },
    playCount: { type: Number, default: 0, min: 0 },
})

songSchema.index({ genre: 1 })
songSchema.index({ likeCount: -1 })
songSchema.index({ playCount: -1 })

module.exports = mongoose.model('Song', songSchema )