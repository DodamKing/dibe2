require('dotenv').config()

const { schedule } = require('@netlify/functions')
const { songService } = require('../../server/services')
const runCron = require('../../server/utils/runCron')

// 08:20 KST — 차트 크론(08:00)이 곡을 저장한 뒤에 돈다.
// 곡 저장과 분리한 이유는 songService.updateGenres 주석 참고.
module.exports.handler = schedule('20 23 * * *', runCron('updateGenres', async (startedAt) => {
    return songService.updateGenres(startedAt)
}))
