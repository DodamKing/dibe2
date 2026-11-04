require('dotenv').config()

const { schedule } = require('@netlify/functions')
const { Chart } = require('../../server/models')
const runCron = require('../../server/utils/runCron')
const chartCron = require('../../server/utils/chartCron')

// 국내 포함 종합 Top 100. 본체(순서·가드·소요시간)는 chartCron 참고
module.exports.handler = schedule('0 23 * * *', runCron('updateChartData', chartCron('day/total', Chart)))
