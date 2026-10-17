const mongoose = require('mongoose')

// 테마 정의 — 원본은 server/services/themeDefinitions.js, 수집 스크립트가 upsert 한다.
// API(GET /api/themes)는 이 컬렉션만 읽는다. 상세는 docs/THEME_PLAYLIST.md
const ThemeSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true }, // URL에 쓰는 식별자 (rain, workout …)
    name: { type: String, required: true },              // 표시 이름 (비 오는 날 …)
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    lastRefreshedAt: Date,                               // 마지막으로 DB에 반영된 수집 시각 — 감쇠 계산 기준
    lastStats: {                                         // 마지막 수집 요약 (점검용)
        playlists: Number,
        core: Number,
        explore: Number,
    },
}, {
    timestamps: true,
})

module.exports = mongoose.model('Theme', ThemeSchema)
