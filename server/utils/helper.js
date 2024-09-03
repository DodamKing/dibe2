const axios = require('axios')
const cheerio = require('cheerio')

async function getLyrics(detailLink) {
    try {
        const response = await axios.get(detailLink);
        const html = response.data;
        const $ = cheerio.load(html);

        // const lyrics = $('.lyricsContainer').text().trim();
        const lyrics = $('xmp').text().trim();
        return lyrics;
    } catch (error) {
        console.error('Error getting lyrics:', error);
        return null;
    }
}

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

}
