require('dotenv').config()

const { schedule } = require('@netlify/functions')
const { songService } = require('../../server/services')
const runCron = require('../../server/utils/runCron')

// 08:10 KST — 차트 크론(08:00)이 곡을 저장한 뒤에 돈다.
// 예전엔 02:00이었으나 특별한 이유가 없었고, "곡 저장 → 필드 채움" 순서를 지키려고 옮김.
//
// 🔴 **유튜브 크론(08:30)보다 앞이어야 한다.** 이 크론이 트랙 상세를 받으면서 `duration` 을
// 같이 채우고, 유튜브 매칭이 그 길이로 후보를 고르기 때문이다. 순서가 뒤집히면 신곡은
// 길이 없이 검색돼 예전의 고정 상한(2~6분)으로 되돌아간다. (2026-08-16에 08:30에서 옮김)
module.exports.handler = schedule('10 23 * * *', runCron('updateLyrics', async (startedAt) => {
    return songService.updateLyrics(startedAt)
}))
