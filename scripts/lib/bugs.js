/**
 * 벅스 크롤링 공용 — HTTP 클라이언트 + HTML 파서.
 *
 * 파서를 여기 모아두는 이유: 벅스가 마크업을 바꾸면 고칠 곳이 한 군데여야 한다.
 * (server/utils/helper.js는 프로덕션 크론용이라 건드리지 않는다. 여기는 로컬 스크립트 전용)
 */
const axios = require('axios')
const cheerio = require('cheerio')

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const sleep = ms => new Promise(r => setTimeout(r, ms))

// 정확히 N초 간격은 그 자체로 봇 신호라 매번 흔든다.
const jitter = (min = 500, max = 2000) => min + Math.floor(Math.random() * (max - min))

function createClient() {
    // 진짜 브라우저는 세션 쿠키를 물고 다닌다. 매 요청 새 세션이면 티가 난다.
    let jar = ''
    const client = axios.create({ timeout: 20000 })
    client.interceptors.response.use(res => {
        const sc = res.headers['set-cookie']
        if (sc) jar = sc.map(c => c.split(';')[0]).join('; ')
        return res
    })
    client.h = (referer = 'https://music.bugs.co.kr/chart') => {
        const h = {
            'User-Agent': UA,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
            'Referer': referer,
        }
        if (jar) h.Cookie = jar
        return h
    }
    return client
}

/**
 * 앨범 ID는 coverUrl 경로에 그대로 들어있다.
 *   .../album/images/50/206680/20668087.jpg → 20668087
 * 덕분에 트랙 페이지를 거치지 않고 앨범 페이지로 바로 갈 수 있다.
 */
function albumIdFromCoverUrl(coverUrl) {
    const m = /\/album\/images\/\d+\/\d+\/(\d+)\./.exec(coverUrl || '')
    return m ? m[1] : null
}

const splitField = t => t.split(',').map(s => s.trim()).filter(Boolean)

/** 벅스는 장르/스타일을 트랙이 아니라 앨범에 붙인다. */
function parseAlbumInfo(html) {
    const $ = cheerio.load(html)
    const out = { genre: [], style: [] }
    $('table.info tbody tr').each((i, el) => {
        const label = $(el).find('th').text().trim()
        const value = $(el).find('td').text().trim().replace(/\s+/g, ' ')
        if (label === '장르') out.genre = splitField(value)
        else if (label === '스타일') out.style = splitField(value)
    })
    return out
}

/** 가사는 트랙 상세 페이지의 <xmp>에 있다. 전용 엔드포인트(lyricsDtl 등)는 404라 이 경로뿐. */
function parseLyrics(html) {
    return cheerio.load(html)('xmp').first().text().trim()
}

/**
 * 벅스는 `[19금]` 배지를 스크린리더용 숨김 텍스트로 제목 셀 **안에** 넣는다:
 *   <button class="badge o19"><span class="blind">[19금]</span></button><a title="BAND">BAND</a>
 * `.title` 을 통째로 text() 하면 "[19금]\nBAND" 가 되어 제목이 오염된다.
 * 제목은 링크 텍스트에서만 가져오고, 19금 여부는 배지 존재로 따로 잡는다.
 *
 * ⚠️ 문자열(`^\[...\]`)로 판별하면 안 된다. `[드포즈 극장] 바그다드 카페`처럼
 * 대괄호가 **진짜 제목**인 곡이 있다(배지는 뒤에 개행이 붙고, 진짜 제목은 공백으로 이어진다).
 * `.title button` 은 19금이 아닌 행에도 있어서 못 쓴다 — `.o19` 로 좁힌다. (실측 2026-07-17)
 */
function parseTitleCell($cell) {
    const linked = $cell.find('a').first().text().trim()
    // 벅스가 마크업을 바꿔 링크가 사라지면 제목이 통째로 빈다. 그럴 바엔 배지만 걷어낸 원문이 낫다.
    const title = linked || $cell.text().trim().replace(/^\[[^\]]+\]\s*\n\s*/, '')
    return { title, adult: $cell.find('.o19').length > 0 }
}

module.exports = {
    UA, sleep, jitter, createClient,
    albumIdFromCoverUrl, parseAlbumInfo, parseLyrics, parseTitleCell,
    albumUrl: id => `https://music.bugs.co.kr/album/${id}`,
}
