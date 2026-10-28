const axios = require('axios')
const cheerio = require('cheerio')

/** 트랙 상세의 `재생 시간 = 06:09` → 369초. 앨범 페이지의 값은 앨범 전체 길이라 못 쓴다. */
function parseTrackDuration($) {
    let text = ''
    $('table.info tbody tr').each((i, el) => {
        if ($(el).find('th').text().trim() === '재생 시간') text = $(el).find('td').text().trim()
    })
    const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(text)
    if (!m) return null
    return m[3]
        ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3])
        : (+m[1]) * 60 + (+m[2])
}

/**
 * 트랙 상세 페이지 한 번으로 **가사와 곡 길이를 같이** 가져온다.
 *
 * 길이를 따로 받지 않는 게 핵심이다 — 가사 크론이 어차피 이 페이지를 받으므로
 * `duration` 은 **요청 0회**로 딸려온다. 길이는 유튜브 매칭에서 고정 상한(2~6분)을
 * 대체하는 기준이라, 이걸 위해 요청을 새로 만들면 크론 예산(30초)이 감당 못 한다.
 *
 * 🔴 반환 계약 — 마커(`lyricsCheckedAt`) 로직이 이 구분에 기대고 있다:
 *   `null`                        네트워크/파싱 실패. **마커를 찍으면 안 된다**(다음 실행에서 재시도)
 *   `{ lyrics: '', duration }`    페이지는 멀쩡한데 가사가 원래 없는 곡. 마커로 닫는다
 *   `{ lyrics: '…', duration }`   정상. duration 은 못 읽으면 `null` 이다(길이 없는 곡이 있다)
 */
async function getTrackDetail(detailLink) {
    try {
        const response = await axios.get(detailLink);
        const $ = cheerio.load(response.data);

        return {
            lyrics: $('xmp').text().trim(),
            duration: parseTrackDuration($),
        }
    } catch (error) {
        console.error('Error getting track detail:', error);
        return null;
    }
}

/** 가사만 필요한 호출부용 얇은 래퍼. 실패 `null` / 가사 없음 `''` 계약은 종전과 같다. */
async function getLyrics(detailLink) {
    const detail = await getTrackDetail(detailLink)
    return detail === null ? null : detail.lyrics
}

const formatter = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
});

/**
 * 앨범 ID는 coverUrl 경로에 그대로 들어있다.
 *   .../album/images/50/206680/20668087.jpg → 20668087
 * 덕분에 트랙 페이지를 거치지 않고 앨범 페이지로 바로 갈 수 있다(요청 1회 절약).
 */
function albumIdFromCoverUrl(coverUrl) {
    const m = /\/album\/images\/\d+\/\d+\/(\d+)\./.exec(coverUrl || '')
    return m ? m[1] : null
}

/**
 * 벅스는 장르/스타일을 트랙이 아니라 **앨범**에 붙인다. 트랙 페이지엔 장르가 없다.
 * genre는 큰 분류(발라드/댄스·팝…), style은 세부 태그(팝 락/TV 드라마…)로 서로 다른 축이다.
 */
async function getAlbumGenre(albumId) {
    try {
        const { data } = await axios.get(`https://music.bugs.co.kr/album/${albumId}`)
        const $ = cheerio.load(data)
        const out = { genre: [], style: [] }
        const split = t => t.split(',').map(s => s.trim()).filter(Boolean)
        $('table.info tbody tr').each((i, el) => {
            const label = $(el).find('th').text().trim()
            const value = $(el).find('td').text().trim().replace(/\s+/g, ' ')
            if (label === '장르') out.genre = split(value)
            else if (label === '스타일') out.style = split(value)
        })
        return out
    } catch (err) {
        console.error('앨범 장르 크롤링 오류:', err.message)
        return null
    }
}

/**
 * 벅스는 `[19금]` 배지를 스크린리더용 숨김 텍스트로 제목 셀 **안에** 넣는다:
 *   <button class="badge o19"><span class="blind">[19금]</span></button><a title="BAND">BAND</a>
 * `.title` 을 통째로 text() 하면 "[19금]\nBAND" 가 되어 제목이 오염된다. 그 오염은
 * UI 노출로 끝나지 않고 **title+artist 를 키로 쓰는 중복 판별**과 유튜브 검색어까지 번진다.
 * 제목은 링크 텍스트에서만 가져오고, 19금 여부는 배지 존재로 따로 잡는다.
 *
 * ⚠️ 문자열(`^\[...\]`)로 판별하면 안 된다. `[드포즈 극장] 바그다드 카페`처럼
 * 대괄호가 **진짜 제목**인 곡이 있다(배지는 뒤에 개행이 붙고, 진짜 제목은 공백으로 이어진다).
 * 배지는 요소가 분리돼 있으므로 셀렉터로 판별하는 게 안전하다.
 * `.title button` 은 19금이 아닌 행에도 있어서 못 쓴다 — `.o19` 로 좁힌다. (실측 2026-07-17)
 */
function parseTitleCell($cell) {
    const linked = $cell.find('a').first().text().trim()
    // 벅스가 마크업을 바꿔 링크가 사라지면 제목이 통째로 빈다. 그럴 바엔 배지만 걷어낸 원문이 낫다.
    const title = linked || $cell.text().trim().replace(/^\[[^\]]+\]\s*\n\s*/, '')
    return { title, adult: $cell.find('.o19').length > 0 }
}

module.exports = {
    getLyrics: getLyrics,
    getTrackDetail,
    albumIdFromCoverUrl,
    getAlbumGenre,
    parseTitleCell,
    // path: 'day/total'(국내 포함 종합, 기본) | 'day/pop'(해외 전체 장르 — J-POP·OST도 섞인다)
    getBugsChart: async (path = 'day/total') => {
        try {
            const url = `https://music.bugs.co.kr/chart/track/${path}`;
            const response = await axios.get(url);
            const html = response.data;
            const $ = cheerio.load(html);

            const chartData = [];

            const rows = $('.list > tbody > tr').toArray();
            for (const element of rows) {
                const rank = $(element).find('.ranking > strong').text().trim();
                const { title, adult } = parseTitleCell($(element).find('.title'))
                const artist = $(element).find('.artist > a').first().text().trim()
                const album = $(element).find('.album').text().trim();
                const coverUrl = $(element).find('.thumbnail > img').attr('src');
                const detailLink = $(element).find('.trackInfo').attr('href');
                // const lyrics = await getLyrics(detailLink);

                chartData.push({
                    rank,
                    title,
                    artist,
                    album,
                    coverUrl,
                    detailLink,
                    adult,
                    // lyrics
                });
            }

            return chartData
        } catch (err) {
            console.error('벅스 크롤링 오류:', err)
            return []
        }
    },

    getBugsDetailUrl: async (query) => {
        try {
            const encodedQuery = encodeURIComponent(query)
            const url = 'https://music.bugs.co.kr/search/integrated?q=' + encodedQuery
            const response = await axios.get(url);
            const html = response.data;
            const $ = cheerio.load(html);
            const detailLink = $('.list > tbody > tr').first().find('.trackInfo').attr('href');

            return detailLink
        } catch (err) {
            console.error('벅스 디테일 링크 크롤링 오류:', err)
        }
    },

    sendErrorToSlack: async (err, req = null, additionalInfo = {}) => {
        const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;

        const message = {
            text: '🚨 DIBE2 에러 발생',
            attachments: [
                {
                    color: '#FF0000',
                    fields: [
                        {
                            title: 'Error Message',
                            value: err.message,
                            short: false,
                        },
                        {
                            title: 'Time (KST)',
                            value: formatter.format(err.occurredAt),
                            short: false,
                        },
                    ],
                },
            ],
        };

        // req 객체가 제공된 경우 관련 정보 추가
        if (req) {
            message.attachments[0].fields.push(
                {
                    title: 'Request URL',
                    value: req.originalUrl || 'N/A',
                    short: false,
                },
                {
                    title: 'Request Method',
                    value: req.method || 'N/A',
                    short: false,
                },
                {
                    title: 'User Agent',
                    value: req.headers['user-agent'] || 'N/A',
                    short: false,
                }
            );
        }

        // 추가 정보 필드 추가
        for (const [key, value] of Object.entries(additionalInfo)) {
            message.attachments[0].fields.push({
                title: key,
                value: String(value),
                short: false,
            });
        }

        if (err.stack) {
            message.attachments[0].fields.push({
                title: 'Stack Trace',
                value: err.stack.split('\n').slice(0, 5).join('\n'), // 첫 5줄만 포함
                short: false,
            });
        }

        try {
            await axios.post(slackWebhookUrl, message);
        } catch (error) {
            console.error('Error sending message to Slack:', error);
        }
    },

    searchBugsMusic: async (query) => {
        try {
            const encodedQuery = encodeURIComponent(query);
            const url = `https://music.bugs.co.kr/search/integrated?q=${encodedQuery}`;
            const response = await axios.get(url);
            const html = response.data;
            const $ = cheerio.load(html);
    
            const searchResults = [];
    
            $('table.list > tbody > tr').each((index, element) => {
                const $el = $(element);
                
                if ($el.attr('rowtype') === 'track') {
                    const { title, adult } = parseTitleCell($el.find('.title'))
                    const artist = $el.find('.artist > a').text().trim();
                    const album = $el.find('.album').text().trim();
                    const coverUrl = $el.find('.thumbnail > img').attr('src');
                    const detailLink = $(element).find('.trackInfo').attr('href');

                    searchResults.push({
                        title,
                        artist,
                        album,
                        coverUrl,
                        detailLink,
                        adult
                    });
                }
    
                // 결과를 20개로 제한
                if (searchResults.length >= 20) return false;
            });
    
            return searchResults;
        } catch (err) {
            console.error('Bugs 음악 검색 중 오류 발생:', err);
            throw err;
        }
    }

}
