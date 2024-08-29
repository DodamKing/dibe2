const express = require('express')
const db = require('../models')
const axios = require('axios')
const cheerio = require('cheerio')

const router = express.Router()

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

router.get('/test', async (req, res) => {
    try {
        const url = 'https://music.bugs.co.kr/chart/track/day/total';
        const response = await axios.get(url);
        const html = response.data;
        const $ = cheerio.load(html);

        const chartData = [];

        const rows = $('.list > tbody > tr').toArray();
        for (const element of rows) {
            const rank = $(element).find('.ranking').text().trim();
            const title = $(element).find('.title').text().trim();
            const artist = $(element).find('.artist').text().trim();
            const album = $(element).find('.album').text().trim();
            const coverUrl = $(element).find('.thumbnail > img').attr('src');
            const detailLink = $(element).find('.trackInfo').attr('href');
            const lyrics = await getLyrics(detailLink);

            chartData.push({
                rank,
                title,
                artist,
                album,
                coverUrl,
                detailLink,
                lyrics
            });
        }

        console.log(chartData);
        res.json({ chartData })
    } catch (error) {
        console.error('Error crawling Bugs chart:', error);
        res.end()
    }
})

module.exports = router