const mongoose = require('mongoose')

// 재생 이력 로그. Song.playCount(누적 집계)와 별개로 "누가 / 무엇을 / 언제" 를 남긴다.
// 추천에 필요한 신호(최근성·개인 취향·시간대)는 카운터만으론 복원이 불가능해서 이벤트로 쌓아둔다.
// 앱은 30초 또는 50% 재생 도달 시 1회만 기록한다(스킵은 카운트 안 됨).
const playEventSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    song: { type: mongoose.Schema.Types.ObjectId, ref: 'Song', required: true },
    // 어디서 재생됐는지 — 추천 시 유입 경로별 가중치에 쓸 수 있다.
    source: { type: String, enum: ['chart', 'playlist', 'search', 'recent', 'video', 'unknown'], default: 'unknown' },
    playedAt: { type: Date, default: Date.now },
})

playEventSchema.index({ user: 1, playedAt: -1 })  // 개인 최근 청취 이력
playEventSchema.index({ song: 1, playedAt: -1 })  // 곡별 기간 인기(트렌딩)
playEventSchema.index({ user: 1, song: 1, playedAt: -1 })  // 중복 기록 가드

// 180일 지난 이력은 자동 삭제. 추천은 최근성이 핵심이라 오래된 이력은 가치가 낮고,
// 누적 재생수는 Song.playCount에 이미 남아 있어 손실이 없다.
playEventSchema.index({ playedAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 })

module.exports = mongoose.model('PlayEvent', playEventSchema)
