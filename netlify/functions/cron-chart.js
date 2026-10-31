require('dotenv').config()

const { schedule } = require('@netlify/functions')
const helper = require('../../server/utils/helper')
const { songService } = require('../../server/services')
const runCron = require('../../server/utils/runCron')

module.exports.handler = schedule('0 23 * * *', runCron('updateChartData', async () => {
    const chartData = await helper.getBugsChart()
    // 0곡이면 여기서 끊는다 — 그대로 가면 아래 함수들이 에러를 삼켜 "성공"으로 끝난다
    if (!chartData || chartData.length === 0) throw new Error('벅스 차트 0곡 — 크롤링 실패(구조 변경·차단 의심)')
    await songService.saveSongData(chartData)
    // saveSongData 다음에 부를 것 — 신곡도 등장 기록에 포함되어야 한다.
    // 이 기록이 뒤따르는 크론(가사 08:10 / 장르 08:20 / 유튜브 08:30)의 처리 순서를 정한다.
    await songService.markCharted(chartData)
    await songService.updateChartData(chartData)
    return { target: chartData.length }
}))
