const db = require('../models')
const helper = require('../utils/helper')
const YouTubeSearch = require('youtube-search-api')
const ytdl = require('@distube/ytdl-core')

// simpleText 형식의 duration을 초 단위로 변환
function parseSimpleTextDuration(simpleText) {
    const parts = simpleText.split(':').map(part => parseInt(part));
    if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    } else {
        console.log('Invalid simpleText duration format:', simpleText);
        return null;
    }
}

module.exports = {
    updateChartData: async (newChartData) => {
        try {
            const currentChart = await db.Chart.findOne()

            if (!currentChart) {
                await db.Chart.create(newChartData)
                console.log('차트 초기 데이터 삽입 성공');
                return 
            }

            let needsUpdate = false

            for (let i = 0; i < 100; i++) {
                const currentItem = currentChart.items[i]
                const newItem = newChartData[i]

                if (
                    currentItem.rank.toString() !== newItem.rank ||
                    currentItem.title !== newItem.title ||
                    currentItem.artist !== newItem.artist ||
                    currentItem.album !== newItem.album ||
                    currentItem.coverUrl !== newItem.coverUrl ||
                    currentItem.detailLink !== newItem.detailLink
                ) {
                    needsUpdate = true
                    break
                }
            }
            
            if (needsUpdate) {
                await db.Chart.updateOne({}, { $set: { items: newChartData }})
                console.log('차트 업데이트 성공')
            }
            else console.log('차트 변경점 없음')
        } catch (err) {
            console.error('차트 업데이트 하다가 에러남:', err)
        }
    },

    getChartData: async () => {
        try {
            const chartData = await db.Chart.findOne()
            return chartData
        } catch (err) {
            console.error('차트 가져오다가 에러남:', err)
        }
    },

    saveSongData: async () => {
        try {
            const chartData = await helper.getBugsChart()
            
            for (const song of chartData) {
                const existingSong = await db.Song.findOne({ title: song.title, artist: song.artist })
                if (!existingSong) {
                    await db.Song.create(song)
                    console.log(`새로운 곡 저장: ${song.title} by ${song.artist}`)
                }
                else console.log(`이미 존재하는 곡: ${song.title} by ${song.artist}`)
            }

            console.log('음원 데이터 저장 완료')
        } catch (err) {
            console.error('음원 데이터 저장 중 에러 발생:', err)
        }
    },

    updateYoutubeUrls: async () => {
        try {
            const songs = await db.Song.find({ youtubeUrl: null })

            for (const song of songs ) {
                try {
                    const searchQuery = `${song.title} ${song.artist} official audio`
                    const searchResults = await YouTubeSearch.GetListByKeyword(searchQuery, false, 10)
    
                    let foundSuitableVideo = false
    
                    if (searchResults && searchResults.items && searchResults.items.length > 0) {
                        for (const item of searchResults.items) {
                            const durationInSeconds = parseSimpleTextDuration(item.length.simpleText)

                            if (durationInSeconds === null) {
                                console.log('길이 파싱 못함', item.title)
                                continue
                            }
    
                            if (durationInSeconds >= 120 && durationInSeconds <= 360) {
                                const videoId = searchResults.items[0].id
                                const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`
    
                                await song.updateOne({ youtubeUrl })
                                console.log(`YouTube URL 업데이트: ${song.title} by ${song.artist}`)
                                foundSuitableVideo = true
                                break
                            }
                        }
                    }
    
                    if (!foundSuitableVideo) console.log(`YouTube URL 결과 없음: ${song.title} by ${song.artist}`)
    
                    // YouTube API 제한을 고려한 딜레이
                    await new Promise(resolve => setTimeout(resolve, 1000))
                } catch (searchErr) {
                    console.error('유튜브 검색하다 에러남:', searchErr)
                }
            }

            console.log('YouTube URL 업데이트 완료')
        } catch (err) {
            console.error('YouTube URL 업데이트 중 오류 발생:', err)
        }
    },

    getAudioStream: async (youtubeUrl) => {
        try {
            const info = await ytdl.getInfo(youtubeUrl)
            const audioFormat  = ytdl.chooseFormat(info.formats, { quality: 'highestaudio', filter: 'audioonly'})

            return ytdl(youtubeUrl, { format: audioFormat })
        } catch (err) {
            console.error('오티오 스트림 추출 중 에러 발생:', err)
            throw err
        }
    },

    getYoutubeUrlbySongId: async (_id) => {
        try {
            const song = await db.Song.findById(_id)
            return song.youtubeUrl
        } catch (err) {
            console.error(err)
        }
    },

    getSongByTitleAndArtist: async (title, artist) => {
        try {
            const song = await db.Song.findOne({ title, artist })
            return song
        } catch (err) {
            console.error(err)
        }
    }
}