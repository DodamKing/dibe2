require('dotenv').config()

const { schedule } = require('@netlify/functions')
const { PopChart } = require('../../server/models')
const helper = require('../../server/utils/helper')
const { songService } = require('../../server/services')
const runCron = require('../../server/utils/runCron')

// 해외(팝) Top 100. 국내 차트(08:00)와 30초 예산을 나눠 쓰지 않게 **따로** 08:05에 돈다.
// 채움 크론(가사 08:10 / 장르 08:20 / 유튜브 08:30)보다 앞이어야 그날 신곡이 같은 아침에 처리된다.
module.exports.handler = schedule('5 23 * * *', runCron('updatePopChartData', async () => {
    const chartData = await helper.getBugsChart('day/pop')
    // 0곡이면 여기서 끊는다 — 그대로 가면 아래 함수들이 에러를 삼켜 "성공"으로 끝난다
    if (!chartData || chartData.length === 0) throw new Error('벅스 차트 0곡 — 크롤링 실패(구조 변경·차단 의심)')
    await songService.saveSongData(chartData)
    await songService.markCharted(chartData)
    await songService.updateChartData(chartData, PopChart)
    return { target: chartData.length }
}))
