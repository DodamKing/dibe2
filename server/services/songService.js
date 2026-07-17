const db = require('../models')
const helper = require('../utils/helper')
const YouTubeSearch = require('youtube-search-api')

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

// youtube-search-api 는 URL을 encodeURI 로 만드는데 encodeURI 는 '#' 을 인코딩하지 않는다.
// 그래서 '#'부터 뒤가 URL 프래그먼트로 잘려나가 search_query 가 통째로 비어버린다
// ("#첫사랑 볼빨간사춘기" → 검색어 ""). 제목에 # 있는 곡은 검색 결과가 영원히 0건이라
// 크론으로도 lazy fill 로도 URL을 못 받는다. 실측으로 확인함(2026-07-16).
const youtubeQuery = (title, artist) =>
    `${title} ${artist} official audio`.replace(/#/g, ' ').replace(/\s+/g, ' ').trim()

// Netlify 스케줄 함수는 **30초 제한이고 설정으로 못 늘린다**(동기 60초 / 백그라운드 15분과 별개).
// 타임아웃은 강제 종료라 catch 가 안 돌아 슬랙 알림도 없이 조용히 죽는다.
// 그래서 크론이 도는 함수는 전부 시간 예산을 보고 스스로 멈춘다.
//
// 곡 수로 끊지 않고 경과 시간으로 끊는 이유: 대상 사이트가 느린 날에도 안 터진다.
// 못 끝낸 곡은 다음 날 이어서 처리되므로 손실이 없다.
const CRON_BUDGET_MS = 22000

const overBudget = startedAt => Date.now() - startedAt > CRON_BUDGET_MS

/**
 * 크론 처리 순서 — **차트에 최근 오른 곡부터, 같은 시각이면 인기 있는 곡부터**.
 *
 * 정렬이 없으면 자연순(≈ _id, 오래된 삽입분부터)이라 대량 적재분이 앞을 막아
 * 오늘 차트에 오른 신곡이 몇 달 뒤에나 처리된다. `lastChartedAt` 은 차트 크론(08:00)이
 * 매일 찍으므로 "지금 사람들이 듣는 곡"이 자동으로 앞에 온다.
 *
 * 2차 키(`chartHits`)가 필요한 이유: 적재분은 `lastChartedAt` 이 **차트 등장 '월' 단위**라
 * 같은 값이 무더기로 생긴다. 그것만으로 정렬하면 그 안에서는 삽입 순서가 이겨버린다.
 * 값이 아예 없는 곡은 뒤로 밀리는데, 신곡을 다 처리하고 남는 예산으로 갉아먹으면 되므로 의도한 동작이다.
 */
const CRON_ORDER = { lastChartedAt: -1, chartHits: -1 }

/**
 * "가사를 아직 못 받은 곡" 조건. 세 가지를 빼야 무한 재시도가 안 생긴다:
 *  - `lyricsCheckedAt` 있음 = 찾아봤는데 없더라(영구 실패). 다시 긁어도 결과가 같다
 *  - `adult` = 19금은 성인 인증(로그인)이 있어야 보인다. 크롤링으로는 원리적으로 못 받는다
 *  - `detailLink` 없음 = 긁을 주소 자체가 없다(수동 추가분 등)
 */
const LYRICS_PENDING = {
    lyrics: { $in: [null, ''] },
    lyricsCheckedAt: { $exists: false },
    adult: { $ne: true },
    detailLink: { $ne: null },
}

const createFlexibleRegex = (query) => {
    // 쿼리의 각 문자 사이에 선택적 공백을 허용하는 정규표현식 생성
    const flexibleQuery = query.split('').join('\\s*');
    return new RegExp(flexibleQuery, 'i');
};

module.exports = {
    updateChartData: async (newChartData) => {
        try {
            const currentChart = await db.Chart.findOne()

            if (!currentChart) {
                await db.Chart.create({ items: newChartData })
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
                await db.Chart.findOneAndUpdate({}, { $set: { items: newChartData } })
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

    saveSongData: async (chartData) => {
        try {
            for (const song of chartData) {
                const existingSong = await db.Song.findOne({ title: song.title, artist: song.artist })
                if (!existingSong) {
                    await db.Song.create(song)
                    console.log(`새로운 곡 저장: ${song.title} by ${song.artist}`)
                }
            }
        } catch (err) {
            console.error('음원 데이터 저장 중 에러 발생:', err)
        }
    },

    updateYoutubeUrls: async () => {
        try {
            const startedAt = Date.now()
            // 대상 전체를 한 번에 가져오지 않는다. 백로그가 수천 곡이면 쿼리부터 무거워진다.
            // youtubeCheckedAt 제외 — 안 그러면 못 찾는 곡이 매일 앞을 막는다(가사와 같은 병).
            const songs = await db.Song.find({
                youtubeUrl: { $in: [null, ''] },
                youtubeCheckedAt: { $exists: false },
            })
                .sort(CRON_ORDER)
                .limit(40)
            let processed = 0

            for (const song of songs) {
                if (overBudget(startedAt)) {
                    console.log(`시간 예산 도달 — ${processed}곡 처리하고 중단(나머지는 다음 실행에서)`)
                    break
                }
                try {
                    const searchQuery = youtubeQuery(song.title, song.artist)
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
                                const videoId = item.id
                                const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`

                                await song.updateOne({ youtubeUrl })
                                console.log(`YouTube URL 업데이트: ${song.title} by ${song.artist}`)
                                foundSuitableVideo = true
                                break
                            }
                        }
                    }

                    // 검색은 됐는데 조건(2~6분)에 맞는 영상이 없는 곡. 매일 같은 검색을 반복해봐야
                    // 결과가 같으므로 닫는다. 검색 자체가 터진 경우는 catch 로 가서 마커가 안 찍힌다.
                    if (!foundSuitableVideo) {
                        console.log(`YouTube URL 결과 없음: ${song.title} by ${song.artist}`)
                        await song.updateOne({ youtubeCheckedAt: new Date() })
                    }
                    processed++

                    // YouTube API 제한을 고려한 딜레이
                    await new Promise(resolve => setTimeout(resolve, 1000))
                } catch (searchErr) {
                    console.error('유튜브 검색하다 에러남:', searchErr)
                }
            }
            console.log(`YouTube URL 업데이트: ${processed}곡 처리`)
        } catch (err) {
            console.error('YouTube URL 업데이트 중 오류 발생:', err)
        }
    },

    updateYoutubeUrl: async (_id) => {
        try {
            const song = await db.Song.findById(_id)
            const searchQuery = youtubeQuery(song.title, song.artist)
            const searchResults = await YouTubeSearch.GetListByKeyword(searchQuery, false, 10)

            let foundSuitableVideo = false
            let youtubeUrl

            if (searchResults && searchResults.items && searchResults.items.length > 0) {
                for (const item of searchResults.items) {
                    const durationInSeconds = parseSimpleTextDuration(item.length.simpleText)

                    if (durationInSeconds === null) {
                        console.log('길이 파싱 못함', item.title)
                        continue
                    }

                    if (durationInSeconds >= 120 && durationInSeconds <= 360) {
                        const videoId = item.id
                        youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`

                        await song.updateOne({ youtubeUrl })
                        console.log(`YouTube URL 업데이트: ${song.title} by ${song.artist}`)
                        foundSuitableVideo = true
                        break
                    }
                }
            }

            if (!foundSuitableVideo) console.log(`YouTube URL 결과 없음: ${song.title} by ${song.artist}`)

            console.log('YouTube URL 업데이트 완료')

            return youtubeUrl
        } catch (err) {
            console.error('YouTube URL 업데이트 중 오류 발생:', err)
        }
    },

    getYoutubeUrlsByYouTubeSearch: async (query) => {
        try {
            const searchResults = await YouTubeSearch.GetListByKeyword(query, false, 5)
            let youtubeUrls = [];

            if (searchResults?.items?.length > 0) {
                for (const item of searchResults.items) {
                    if (!item.length?.simpleText) continue

                    const durationInSeconds = parseSimpleTextDuration(item.length.simpleText)

                    if (durationInSeconds === null) continue

                    // 2분(120초) ~ 6분(360초) 사이의 영상만 수집
                    if (durationInSeconds >= 120 && durationInSeconds <= 360) {
                        youtubeUrls.push({
                            id: item.id,
                            url: `https://www.youtube.com/watch?v=${item.id}`,
                            title: item.title,
                            duration: item.length.simpleText,
                            thumbnail: item.thumbnail?.thumbnails?.[0]?.url || '',
                            channelTitle: item.channelTitle || ''
                        });
                    }
                }
            }

            if (youtubeUrls.length === 0) {
                return {
                    success: false,
                    message: '적절한 YouTube 동영상을 찾을 수 없습니다.',
                    results: []
                }
            } 

            return {
                success: true,
                message: `${youtubeUrls.length}개의 YouTube 동영상을 찾았습니다.`,
                results: youtubeUrls
            }

        } catch (err) {
            console.error('YouTube URL 수집 중 오류 발생:', err)
            throw err
        }
    },

    // 비디오 페이지 전용 검색 — getYoutubeUrlsByYouTubeSearch와 달리 길이 필터 없이 영상만 골라 반환
    searchYoutubeForVideo: async (query, limit = 20) => {
        const results = await YouTubeSearch.GetListByKeyword(query, false, limit)
        const items = (results?.items || [])
            .filter(item => item.type === 'video')
            .map(item => ({
                id: item.id,
                title: item.title,
                duration: item.length?.simpleText || '',
                thumbnail: item.thumbnail?.thumbnails?.slice(-1)[0]?.url || '',
                channelTitle: item.channelTitle || ''
            }))
        return { items }
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
                .select('_id title artist coverUrl lyrics')
            return song
        } catch (err) {
            console.error(err)
        }
    },

    getSongsByIds: async (ids) => {
        try {
            // lean() — 응답은 어차피 JSON이고, statsService.attachLikedFlags가 스프레드로
            // liked를 붙이려면 순수 객체여야 한다(하이드레이트된 문서는 스프레드가 안 먹힌다).
            const songs = await db.Song.find({ _id: { $in: ids } })
                .select('_id title artist coverUrl likeCount playCount')
                .lean()
            return songs
        } catch (err) {
            console.error(err)
            return []
        }
    },

    /**
     * 가사 조회 + **즉석 채우기(lazy fill)**.
     *
     * 크론(08:30)만으로는 백로그를 다 채우는 데 수개월이 걸린다. 사용자가 실제로 튼 곡을
     * 그 자리에서 채우면 그 대기가 사실상 사라진다. youtubeUrl 의 `getYoutubeId` 와 같은 패턴이고,
     * 크론과 lazy fill 이 둘 다 "가사 없는 곡"만 고르므로 먼저 채운 쪽이 상대 대상에서 빠져 중복이 없다.
     *
     * 반환은 문자열이 아니라 `{ lyrics, adult }` 다 — 19금은 "가사 없음"이 아니라
     * "19금이라 제공 안 됨"으로 구분해서 보여줘야 하기 때문.
     */
    getLyrics: async (id) => {
        try {
            const song = await db.Song.findById(id).select('lyrics adult detailLink lyricsCheckedAt')
            if (!song) return { lyrics: '', adult: false }
            if (song.lyrics) return { lyrics: song.lyrics, adult: !!song.adult }

            // 아래는 전부 "긁어봐야 소용없는" 경우 — 요청을 아낀다.
            // 19금은 성인 인증이 있어야 보이므로 눌릴 때마다 시도하면 벅스만 때린다.
            if (song.adult) return { lyrics: '', adult: true }
            // 이미 "찾아봤는데 없더라"로 닫힌 곡
            if (song.lyricsCheckedAt) return { lyrics: '', adult: false }
            if (!song.detailLink) return { lyrics: '', adult: false }

            const lyrics = await helper.getLyrics(song.detailLink)
            // null = 네트워크 실패. 마커를 안 찍어야 크론이 나중에 다시 시도한다.
            if (lyrics === null) return { lyrics: '', adult: false }

            await db.Song.updateOne(
                { _id: id },
                lyrics ? { lyrics, lyricsCheckedAt: new Date() } : { lyricsCheckedAt: new Date() },
            )
            return { lyrics: lyrics || '', adult: false }
        } catch (err) {
            console.error(err)
            return { lyrics: '', adult: false }
        }
    },

    /**
     * 차트에 오른 곡들에 등장 시각/횟수를 기록한다. 크론 우선순위(`lastChartedAt`)와
     * 추천 신호(`chartHits`)가 여기서 나온다. `saveSongData` 다음에 불러야 신곡도 포함된다.
     * 100곡을 순차 update 하면 30초 예산이 아까우므로 bulkWrite 한 방으로 처리한다.
     */
    markCharted: async (chartData) => {
        try {
            const now = new Date()
            const ops = chartData.map(song => ({
                updateOne: {
                    filter: { title: song.title, artist: song.artist },
                    update: { $set: { lastChartedAt: now }, $inc: { chartHits: 1 } },
                },
            }))
            if (!ops.length) return
            const res = await db.Song.bulkWrite(ops, { ordered: false })
            console.log(`차트 등장 기록: ${res.modifiedCount}곡`)
        } catch (err) {
            console.error('차트 등장 기록 중 에러:', err)
        }
    },

    searchSong: async (query, type, page = 1, limit = 20) => {
        const skip = (page - 1) * limit;
        const flexibleRegex = createFlexibleRegex(query);
        let searchCriteria;

        if (type === 'all') {
            searchCriteria = {
                $or: [
                    { title: { $regex: flexibleRegex } },
                    { artist: { $regex: flexibleRegex } },
                    // { album: { $regex: flexibleRegex } },
                    // { lyrics: { $regex: exactRegex } }
                ]
            };
        } else if (type === 'lyrics') {
            searchCriteria = {
                [type]: { $regex: query, $options: 'i' }
            };
        } else {
            searchCriteria = {
                [type]: { $regex: flexibleRegex }
            };
        }

        const [items, total] = await Promise.all([
            db.Song.find(searchCriteria)
                .select('-__v') // Exclude the version key
                .skip(skip)
                .limit(limit)
                .lean(),
            db.Song.countDocuments(searchCriteria)
        ]);

        return {
            items,
            total,
            hasMore: skip + items.length < total
        };
    },

    updateLyrics: async () => {
        try {
            const startedAt = Date.now()
            const songs = await db.Song.find(LYRICS_PENDING)
                .sort(CRON_ORDER)
                .limit(120)
            let processed = 0, closed = 0

            for (const song of songs) {
                if (overBudget(startedAt)) {
                    console.log(`시간 예산 도달 — ${processed}곡 처리하고 중단(나머지는 다음 실행에서)`)
                    break
                }
                try {
                    const lyrics = await helper.getLyrics(song.detailLink)

                    // null = 네트워크/파싱 실패. 마커를 찍지 않아야 다음 실행에서 재시도된다.
                    if (lyrics === null) continue

                    // '' = 페이지는 멀쩡한데 가사가 원래 없는 곡. 여기서 닫지 않으면 영원히 재시도한다.
                    if (!lyrics) {
                        await song.updateOne({ lyricsCheckedAt: new Date() })
                        closed++
                        continue
                    }

                    await song.updateOne({ lyrics, lyricsCheckedAt: new Date() })
                    processed++
                } catch (err) {
                    console.error(`가사 업데이트 에러: ${song.title} by ${song.artist}`)
                }
            }
            console.log(`가사 업데이트: ${processed}곡 채움 | ${closed}곡 "가사 없음"으로 닫음`)
        } catch (err) {
            console.error('가사 업데이트 중 에러: ', err)
        }
    },

    /**
     * 장르/스타일 채우기. 곡 저장(cron-chart)과 분리한 이유:
     * 앨범 요청이 cron-chart 안에 있으면 신곡이 많은 날 30초를 넘겨 **곡 저장 자체가 실패**한다.
     * 가사/유튜브와 같은 "저장 먼저, 필드는 나중에" 패턴을 따른다.
     */
    updateGenres: async () => {
        try {
            const startedAt = Date.now()
            // genre 필드가 아예 없는 문서만. 빈 배열([])은 "찾아봤는데 없더라"라 재시도하지 않는다.
            const songs = await db.Song.find({ genre: { $exists: false }, coverUrl: { $ne: null } })
                .sort(CRON_ORDER)
                .limit(120)
            let processed = 0

            // 같은 앨범 곡은 값이 같다. 한 번의 실행 안에서만이라도 캐시하면 요청이 준다.
            const cache = new Map()

            for (const song of songs) {
                if (overBudget(startedAt)) {
                    console.log(`시간 예산 도달 — ${processed}곡 처리하고 중단(나머지는 다음 실행에서)`)
                    break
                }
                try {
                    const albumId = helper.albumIdFromCoverUrl(song.coverUrl)
                    if (!albumId) {
                        // 앨범 ID를 못 뽑으면 매번 다시 시도해도 결과가 같다. 빈 값으로 닫는다.
                        await song.updateOne({ genre: [], style: [] })
                        processed++
                        continue
                    }
                    if (!cache.has(albumId)) cache.set(albumId, await helper.getAlbumGenre(albumId))
                    const info = cache.get(albumId)
                    if (!info) continue // 네트워크 실패 — 다음 실행에서 재시도

                    await song.updateOne({ genre: info.genre, style: info.style })
                    processed++
                } catch (err) {
                    console.error(`장르 업데이트 에러: ${song.title} by ${song.artist}`)
                }
            }
            console.log(`장르 업데이트: ${processed}곡 처리 (앨범 요청 ${cache.size}회)`)
        } catch (err) {
            console.error('장르 업데이트 중 에러: ', err)
        }
    },

    getYoutubeId: async (songId) => {
        try {
            const song = await db.Song.findById(songId)
            if (!song) return null

            // youtubeUrl은 곡 저장(차트 크론 08:00)보다 늦게 채워진다(유튜브 크론 08:10).
            // 그 사이에 눌린 곡은 여기서 즉석으로 채운다. 크론과 같은 검색을 쓰고, 둘 다
            // "URL 없는 곡"만 고르므로 먼저 채운 쪽이 상대의 대상에서 빠져 중복은 안 생긴다.
            let youtubeUrl = song.youtubeUrl
            if (!youtubeUrl) youtubeUrl = await module.exports.updateYoutubeUrl(songId)

            // 즉석 채우기도 실패할 수 있다(2~6분 조건에 맞는 영상이 없는 경우).
            // undefined.match()로 터뜨리지 말고 "없음"을 알린다.
            if (!youtubeUrl) return null

            const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
            const match = youtubeUrl.match(regExp)
            return (match && match[2].length === 11) ? match[2] : null;
        } catch (err) {
            console.error('유뷰트 아이디:', err)
            throw err
        }
    },

    addSong: async (song) => {
        try {
            const existingSong = await db.Song.findOne({ title: song.title, artist: song.artist })
            if (existingSong) return { success: false, message: '이미 존재하는 곡입니다.', song: existingSong }

            const newSong = await db.Song.create(song)
            return { success: true, message: '새 음원이 성공적으로 추가되었습니다.', song: newSong }
        } catch (error) {
            console.error('음원 추가 중 오류 발생:', error)
            throw new Error('서버 오류가 발생했습니다.')
        }
    },

    updateSong: async (songId, updateData) => {
        try {
            const updatedSong = await db.Song.findByIdAndUpdate(songId, updateData, { new: true })
            if (!updatedSong) {
                return { success: false, message: '음원을 찾을 수 없습니다.' }
            }
            return { success: true, updatedSong, message: '음원이 성공적으로 수정되었습니다.' }
        } catch (error) {
            console.error('음원 수정 중 오류 발생:', error)
            throw new Error('서버 오류가 발생했습니다.')
        }
    },

    delete: async (songId) => {
        try {
            const deleteSong = await db.Song.findByIdAndDelete(songId)
            return deleteSong
        } catch (error) {
            if (error.name === 'CastError') return null
            throw error
        }
    }
}