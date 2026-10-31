const mongoose = require('mongoose')

/**
 * 크론 실행 기록. 한 실행 = 한 문서. `server/utils/runCron.js`만 쓴다.
 *
 * status
 *  - running : 시작만 기록됨. **이대로 남아 있으면 30초 제한에 강제 종료된 것**(끝 처리가 못 돎)
 *  - ok      : 정상 종료
 *  - wiped   : 끝까지 돌았는데 진행 0 + 실패>0 (예: 유튜브가 빈 결과로 막음)
 *  - error   : 예외로 중단
 * 기록이 아예 없으면 = 함수가 실행되지 않은 것.
 */
const cronRunSchema = new mongoose.Schema({
    job: { type: String, required: true },
    status: { type: String, enum: ['running', 'ok', 'wiped', 'error'], default: 'running' },
    startedAt: { type: Date, default: Date.now },
    finishedAt: Date,
    durationMs: Number,
    // 대상 곡 수 / 채움 / 없음확정(마커로 닫음) / 실패 / 22초 예산에 걸려 중간에 멈췄나
    stats: {
        target: Number,
        filled: Number,
        closed: Number,
        failed: Number,
        budgetHit: Boolean,
    },
    error: String,
})

cronRunSchema.index({ job: 1, startedAt: -1 })
// 1년 지나면 자동 삭제. 한 건 ~300B × 하루 6건이라 1년에 1MB도 안 된다
cronRunSchema.index({ startedAt: 1 }, { expireAfterSeconds: 365 * 86400 })

module.exports = mongoose.model('CronRun', cronRunSchema)
