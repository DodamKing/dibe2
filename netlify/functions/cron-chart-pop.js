require('dotenv').config()

const { schedule } = require('@netlify/functions')
const { PopChart } = require('../../server/models')
const runCron = require('../../server/utils/runCron')
const chartCron = require('../../server/utils/chartCron')

// 해외(팝) Top 100. 국내 차트(08:00)와 30초 예산을 나눠 쓰지 않게 **따로** 08:05에 돈다.
// 채움 크론(가사 08:10 / 장르 08:20 / 유튜브 08:30)보다 앞이어야 그날 신곡이 같은 아침에 처리된다.
module.exports.handler = schedule('5 23 * * *', runCron('updatePopChartData', chartCron('day/pop', PopChart)))
