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

// 해외(팝) 차트는 **컬렉션을 따로** 둔다. 같은 컬렉션에 kind로 넣으면 기존의 조건 없는
// `Chart.findOne()`(서비스·scripts/cron-health.js)이 어느 문서를 집을지 모르게 된다.
const Chart = mongoose.model('Chart', chartSchema)
const PopChart = mongoose.model('PopChart', chartSchema, 'popcharts')

module.exports = { Chart, PopChart }