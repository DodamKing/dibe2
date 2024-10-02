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

module.exports = {
    getLyrics: getLyrics,
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
