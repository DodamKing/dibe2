const mongoose = require('mongoose')

// 재생 이력 로그. Song.playCount(누적 집계)와 별개로 "누가 / 무엇을 / 언제" 를 남긴다.
// 추천에 필요한 신호(최근성·개인 취향·시간대)는 카운터만으론 복원이 불가능해서 이벤트로 쌓아둔다.
// 앱은 30초 또는 50% 재생 도달 시 1회만 기록한다(스킵은 카운트 안 됨).
//
// 2026-11-08: 유튜브 영상(테마 곡·영상 페이지)도 같은 컬렉션에 쌓는다 — 한 건은 song(벅스 곡) 또는 videoId 둘 중 하나.
// 영상은 Song 이 없어 제목·아티스트를 그때 값으로 같이 남긴다. 🔴 PlayEvent 를 song 으로 집계하는 곳은
// 영상 행(song 없음)을 걸러야 한다
const playEventSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    song: { type: mongoose.Schema.Types.ObjectId, ref: 'Song' },
    videoId: { type: String },
    title: { type: String },  // 영상만 — 그때 제목(Song 이 없어서)
    artist: { type: String }, // 영상만 — 테마 곡은 아티스트, 영상 페이지는 채널명
    theme: { type: String },  // 테마에서 재생했으면 Theme.key
    // 웹/앱 — 서버가 User-Agent 로 판단(앱은 Dart 기본 UA "Dart/x.y (dart:io)"). 2026-11-08 이전 행엔 없다
    platform: { type: String, enum: ['web', 'app'] },
    // 어디서 재생됐는지 — 추천 시 유입 경로별 가중치에 쓸 수 있다.
    source: { type: String, enum: ['chart', 'playlist', 'search', 'recent', 'video', 'theme', 'unknown'], default: 'unknown' },
    playedAt: { type: Date, default: Date.now },
})

playEventSchema.pre('validate', function (next) {
    if (!this.song && !this.videoId) return next(new Error('PlayEvent 에는 song 또는 videoId 가 필요하다'))
    next()
})

playEventSchema.index({ user: 1, playedAt: -1 })  // 개인 최근 청취 이력
playEventSchema.index({ song: 1, playedAt: -1 })  // 곡별 기간 인기(트렌딩)
playEventSchema.index({ user: 1, song: 1, playedAt: -1 })  // 중복 기록 가드
playEventSchema.index({ videoId: 1, playedAt: -1 }, { partialFilterExpression: { videoId: { $type: 'string' } } })  // 영상별 인기·중복 가드

// 180일 지난 이력은 자동 삭제. 추천은 최근성이 핵심이라 오래된 이력은 가치가 낮고,
// 누적 재생수는 Song.playCount에 이미 남아 있어 손실이 없다.
playEventSchema.index({ playedAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 })

module.exports = mongoose.model('PlayEvent', playEventSchema)
