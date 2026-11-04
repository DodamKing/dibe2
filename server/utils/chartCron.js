const { songService } = require('../services')
const helper = require('./helper')

/**
 * 차트 크론 공통 본체 — `runCron(job, chartCron(path, model))` 로 쓴다(cron-chart.js / cron-chart-pop.js).
 *
 * 순서가 중요하다: 곡 저장 → **차트 저장** → 등장 기록.
 * 사용자에게 보이는 건 차트라 30초에 걸려도 차트부터 살린다(2026-11-04 해외 차트가 등장 기록까지 마치고
 * 차트 저장 직전에 강제 종료돼 하루 묵은 차트가 나갔다). 등장 기록은 곡 저장 뒤면 된다(신곡의 songId 필요).
 *
 * 단계별 소요시간(ms)을 stats 에 남긴다 — 30초 중 어디가 무거운지 Netlify 로그 없이 cronruns 로 본다.
 */
module.exports = (path, model) => async (startedMs) => {
    const ms = {}
    let last = startedMs
    const lap = key => { const t = Date.now(); ms[key] = t - last; last = t }

    lap('setup') // DB 연결 + 실행 기록(runCron)
    const chartData = await helper.getBugsChart(path)
    lap('fetch')
    // 100곡 미만 = 페이지는 받았는데 파싱이 깨진 것(구조 변경). 요청 실패는 getBugsChart 가 이미 throw 한다
    if (chartData.length < 100) throw new Error(`벅스 차트 ${chartData.length}곡 — 파싱 실패(구조 변경 의심)`)

    await songService.saveSongData(chartData)
    lap('save')
    await songService.updateChartData(chartData, model)
    lap('chart')
    // 크론 처리 순서(lastChartedAt)를 정한다 — 뒤따르는 가사 08:10 / 장르 08:20 / 유튜브 08:30
    const marked = await songService.markCharted(chartData)
    lap('mark')

    return { target: chartData.length, marked, ms }
}
