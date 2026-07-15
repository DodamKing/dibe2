const mongoose = require('mongoose')

// 사용자별 좋아요. Song.likeCount는 이 컬렉션의 집계를 비정규화한 캐시값이다.
// (user, song) 유니크 인덱스가 중복 좋아요를 DB 레벨에서 막아준다 →
// upsert의 upsertedCount로 "새로 눌렀는지"를 판별해 카운터를 원자적으로 증감한다.
const likeSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    song: { type: mongoose.Schema.Types.ObjectId, ref: 'Song', required: true },
}, {
    timestamps: true
})

likeSchema.index({ user: 1, song: 1 }, { unique: true })
likeSchema.index({ user: 1, createdAt: -1 })  // 내가 좋아요한 곡 최신순
likeSchema.index({ song: 1 })                 // 카운터 재계산/역조회

module.exports = mongoose.model('Like', likeSchema)
