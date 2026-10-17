const mongoose = require('mongoose')

// 테마별 후보 곡 풀 — 유튜브 영상 기준이라 Song 컬렉션과 무관(벅스에 없는 곡도 있다).
// API는 여기서 50곡을 골라 응답한다(themeService.buildList). 상세는 docs/THEME_PLAYLIST.md
const ThemeSongSchema = new mongoose.Schema({
    theme: { type: String, required: true },   // Theme.key
    songKey: { type: String, required: true }, // 같은 곡 판정 키 (본제목|아티스트토큰) — 영상이 바뀌어도 같은 곡이면 같은 키
    videoId: { type: String, required: true }, // 대표 영상 (Topic > 공식 > 최다 등장)
    title: String,
    artist: String,
    duration: Number,                          // 초
    score: { type: Number, default: 0 },       // 누적 점수 — 갱신마다 감쇠 후 이번 점수를 더한다
    count: Number,                             // 마지막으로 보인 수집에서 등장한 플레이리스트 수
    share: Number,                             // count / 그 수집의 플레이리스트 수 — 테마 특이성 계산용
    tier: { type: String, enum: ['core', 'explore'] }, // core = 2개+ 리스트(합의된 곡), explore = 1회(탐색용)
    foreign: { type: Boolean, default: false },        // 해외곡 — 50곡 중 최대 5곡
    lastSeenAt: Date,                          // 마지막으로 수집에서 보인 시각
}, {
    timestamps: true,
})

ThemeSongSchema.index({ theme: 1, songKey: 1 }, { unique: true })
ThemeSongSchema.index({ theme: 1, score: -1 })

module.exports = mongoose.model('ThemeSong', ThemeSongSchema)
