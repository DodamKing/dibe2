const mongoose = require('mongoose')

const chartItemSchema  = new mongoose.Schema({
    rank: Number,
    title: { type: String, trim: true },
    artist: { type: String, trim: true },
    album: { type: String, trim: true },
    coverUrl: { type: String, trim: true },
    detailLink: { type: String, trim: true },
    lyrics: { type: String, trim: true },
    updateAt: Date,
    // Song._id. 차트 크론(saveSongData)이 붙인다. 🔴 항목 자체의 `_id`(서브문서 id)와 헷갈리지 말 것 —
    // 그건 `$set items` 때마다 새로 생기는 값이라 곡을 가리키지 않는다(웹이 그걸 곡 id로 플리에 넣던 버그, 2026-10-31)
    songId: { type: mongoose.Schema.Types.ObjectId, ref: 'Song' },
})

const chartSchema = new mongoose.Schema({
    lastUpdated: { type: Date, default: Date.now },
    items: [chartItemSchema]
})

chartSchema.pre('findOneAndUpdate', function(next) {
    this.set({ lastUpdated: new Date() })
    next()
})

// 해외(팝) 차트는 **컬렉션을 따로** 둔다. 같은 컬렉션에 kind로 넣으면 기존의 조건 없는
// `Chart.findOne()`(서비스·scripts/cron-health.js)이 어느 문서를 집을지 모르게 된다.
const Chart = mongoose.model('Chart', chartSchema)
const PopChart = mongoose.model('PopChart', chartSchema, 'popcharts')

module.exports = { Chart, PopChart }