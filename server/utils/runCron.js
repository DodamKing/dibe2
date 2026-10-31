const { connectToMongoDB, CronRun } = require('../models')
const { sendErrorToDiscord } = require('./helper')

/**
 * 크론 공통 래퍼 — 실행마다 `cronruns`에 기록을 남기고, 전멸·에러면 디스코드로 알린다.
 *
 * 왜 시작 시점에 먼저 기록하나: Netlify 스케줄 함수는 30초에 **강제 종료**돼 끝 처리가 안 돈다.
 * 시작할 때 `running`으로 만들어 두면, 그대로 남은 문서가 곧 "타임아웃으로 죽었다"는 증거가 된다.
 *
 * task 는 `{ target, filled, closed, failed, budgetHit }`(있는 것만)를 돌려준다.
 * 진행(filled+closed) 0 + 실패>0 이면 `wiped` — per-song catch 가 에러를 삼켜 200이 나가는
 * "초록불인데 죽음"을 잡는다(예전 `alertIfWiped`의 역할).
 *
 * 알림·기록은 전부 await — 리턴하는 순간 함수가 얼어붙어 안 기다린 요청은 사라진다.
 */
const runCron = (job, task) => async () => {
    const startedAt = new Date()
    console.log(`${job} 시작:`, startedAt.toISOString())
    let run = null

    // 기록 실패가 알림까지 막으면 안 된다 — 기록은 삼키고 로그만 남긴다
    const finish = async (status, stats, err) => {
        if (!run) return
        try {
            await run.updateOne({
                status, stats, error: err ? err.message : undefined,
                finishedAt: new Date(), durationMs: Date.now() - startedAt,
            })
        } catch (e) {
            console.error(`${job} 실행 기록 실패:`, e.message)
        }
    }

    try {
        await connectToMongoDB()
        run = await CronRun.create({ job, startedAt })

        const stats = (await task()) || {}
        const progressed = (stats.filled || 0) + (stats.closed || 0)
        const wiped = progressed === 0 && stats.failed > 0
        await finish(wiped ? 'wiped' : 'ok', stats)

        console.log(`${job} ${wiped ? '전멸' : '완료'}:`, JSON.stringify(stats))
        if (wiped) {
            await sendErrorToDiscord(
                new Error(`${job} 전멸: ${stats.failed}곡 시도, 진행 0`),
                null, { context: 'Cron', jobName: job },
            )
        }
        return { statusCode: 200 }
    } catch (err) {
        console.error(`${job} 에러:`, err)
        await finish('error', undefined, err)
        await sendErrorToDiscord(err, null, { context: 'Cron', jobName: job })
        return { statusCode: 500 }
    }
}

module.exports = runCron
