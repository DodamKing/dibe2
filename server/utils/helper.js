const axios = require('axios')
const cheerio = require('cheerio')

async function getLyrics(detailLink) {
    try {
        const response = await axios.get(detailLink);
        const html = response.data;
        const $ = cheerio.load(html);

        const lyrics = $('xmp').text().trim();
        return lyrics;
    } catch (error) {
        console.error('Error getting lyrics:', error);
        return null;
    }
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

module.exports = {
    getLyrics: getLyrics,
    albumIdFromCoverUrl,
    getAlbumGenre,
    getBugsChart: async () => {
        try {
            const url = 'https://music.bugs.co.kr/chart/track/day/total';
            const response = await axios.get(url);
            const html = response.data;
            const $ = cheerio.load(html);

            const chartData = [];

            const rows = $('.list > tbody > tr').toArray();
            for (const element of rows) {
                const rank = $(element).find('.ranking > strong').text().trim();
                const title = $(element).find('.title').text().trim();
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
                    const title = $el.find('.title').text().trim();
                    const artist = $el.find('.artist > a').text().trim();
                    const album = $el.find('.album').text().trim();
                    const coverUrl = $el.find('.thumbnail > img').attr('src');
                    const detailLink = $(element).find('.trackInfo').attr('href');

                    searchResults.push({
                        title,
                        artist,
                        album,
                        coverUrl,
                        detailLink
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
