const db = require('../models')
const helper = require('../utils/helper')
const searchService = require('./searchService')
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

/**
 * 후보 영상의 길이가 이 곡의 것인지 판정한다. **매칭 정책의 핵심이라 한 곳에만 둔다** —
 * 크론/lazy fill 이 각자 조건을 들고 있으면 한 군데만 고쳐서 어긋난다(실제로 그랬다).
 *
 * 🔴 **반드시 이중화** — `duration` 은 아티스트 수집분 167곡에만 있고 기존 13,760곡엔 없다.
 * 길이를 필수로 보면 대부분의 곡이 후보를 하나도 못 고른다. 길이가 있을 때만 정밀해진다.
 *
 * ±5초 근거(2026-08 아티스트 수집 실측): 정답 후보의 길이차는 0~2초 65건 / 3~5초 20건에
 * 몰리는 반면, 라이브·다른 버전은 16초 이상으로 31건이 확연히 갈렸다.
 * 고정 상한은 6분 넘는 곡을 영영 못 찾고(`Mandrake` 6:09) 라이브를 통과시킨다.
 *
 * ⚠️ 반주(Instrumental)는 이걸로 못 거른다 — 원곡과 길이가 같다. 제목으로 걸러야 한다.
 */
const DURATION_TOLERANCE_SEC = 5
const durationFits = (songDuration, videoSeconds) => songDuration
    ? Math.abs(videoSeconds - songDuration) <= DURATION_TOLERANCE_SEC
    : (videoSeconds >= 120 && videoSeconds <= 360)

// youtube-search-api 는 URL을 encodeURI 로 만드는데 encodeURI 는 '#' 을 인코딩하지 않는다.
// 그래서 '#'부터 뒤가 URL 프래그먼트로 잘려나가 search_query 가 통째로 비어버린다
// ("#첫사랑 볼빨간사춘기" → 검색어 ""). 제목에 # 있는 곡은 검색 결과가 영원히 0건이라
// 크론으로도 lazy fill 로도 URL을 못 받는다. 실측으로 확인함(2026-07-16).
const youtubeQuery = (title, artist) =>
    `${title} ${artist} official audio`.replace(/#/g, ' ').replace(/\s+/g, ' ').trim()

/**
 * 유튜브는 로그인 안 한 검색에 **"연령을 인증하세요" 화면만 돌려주는 검색어**가 있다(2026-11-07 실측).
 * 성인곡이라서가 아니다 — `약속 박화요비`, `Talk Saxy RIIZE` 처럼 평범한 곡도 걸린다.
 * 지역(gl)·언어·동영상 필터·"official audio" 빼기·내부 검색 API 어느 쪽으로도 안 풀린다.
 * 라이브러리는 이걸 그냥 "결과 0개"로 돌려줘서 일시 차단과 구분이 안 된다 → 0개일 때만 원본을 한 번 더 본다.
 *
 * 걸린 곡은 `youtubeGatedAt` 을 찍고 **다시 시도하지 않는다**. 관리자가 로그인한 브라우저에서 찾아
 * 주소를 넣는다(관리자 음원 관리 → "연령 게이트" 필터). 주소를 저장하면 표시가 지워진다(updateSong).
 * 찍지 않으면 매일 크론 맨 앞에서 예산을 먹어 뒤쪽 곡이 하루 3~7곡밖에 안 채워졌다.
 */
async function isAgeGated(query) {
    try {
        const res = await fetch('https://www.youtube.com/results?search_query=' + encodeURIComponent(query), {
            headers: { 'accept-language': 'ko-KR,ko;q=0.9' },
        })
        const html = await res.text()
        return html.includes('"backgroundPromoRenderer"') && !html.includes('"videoRenderer"')
    } catch (err) {
        return false // 확인 못 하면 게이트로 보지 않는다(멀쩡한 곡을 닫지 않게)
    }
}

// 유튜브 검색. gated=true 면 연령 게이트(결과 0개일 때만 확인한다)
async function searchYoutube(query, limit = 10) {
    const res = await YouTubeSearch.GetListByKeyword(query, false, limit)
    const items = (res && res.items) || []
    const gated = items.length === 0 ? await isAgeGated(query) : false
    return { items, gated }
}

// Netlify 스케줄 함수는 **30초 제한이고 설정으로 못 늘린다**(동기 60초 / 백그라운드 15분과 별개).
// 타임아웃은 강제 종료라 catch 가 안 돌아 알림도 없이 조용히 죽는다.
// 그래서 크론이 도는 함수는 전부 시간 예산을 보고 스스로 멈춘다.
//
// 🔴 예산은 **함수 시작 시각**(runCron 이 넘겨줌)부터 잰다. 서비스 안에서 새로 재면 콜드 스타트·
// DB 연결(~2초)이 예산 밖으로 빠진다 — 실측 2026-10-31 유튜브 수동 실행이 예산 안에서 멈췄는데도
// 함수 전체 **28.1초**(제한 30초)였다. 기본값 Date.now() 는 스크립트에서 직접 부를 때용.
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
    const flexibleQuery = String(query || '').split('').join('\\s*');
    return new RegExp(flexibleQuery, 'i');
};

module.exports = {
    // model: db.Chart(국내 종합, 기본) | db.PopChart(해외)
    // 차트 크론 3함수(updateChartData·saveSongData·markCharted)는 에러를 삼키지 않는다 — 삼키면 실패해도
    // cronruns 에 ok 가 찍히고 알림도 안 간다(2026-11-04 수정). 호출부(runCron)가 받아 기록·알림한다.
    updateChartData: async (newChartData, model = db.Chart) => {
        const currentChart = await model.findOne()

        if (!currentChart) {
            await model.create({ items: newChartData })
            console.log('차트 초기 데이터 삽입 성공');
            return
        }

        let needsUpdate = currentChart.items.length !== newChartData.length

        for (let i = 0; !needsUpdate && i < newChartData.length; i++) {
            const currentItem = currentChart.items[i]
            const newItem = newChartData[i]

            // songId 도 비교한다 — 안 그러면 순위가 그대로인 날엔 songId 가 영영 안 채워진다
            if (
                String(currentItem.songId) !== String(newItem.songId) ||
                currentItem.rank.toString() !== newItem.rank ||
                currentItem.title !== newItem.title ||
                currentItem.artist !== newItem.artist ||
                currentItem.album !== newItem.album ||
                currentItem.coverUrl !== newItem.coverUrl ||
                currentItem.detailLink !== newItem.detailLink
            ) {
                needsUpdate = true
            }
        }

        if (needsUpdate) {
            await model.findOneAndUpdate({}, { $set: { items: newChartData } })
        }
        else console.log('차트 변경점 없음')
    },

    getChartData: async (model = db.Chart) => {
        try {
            const chartData = await model.findOne().lean()
            return chartData
        } catch (err) {
            console.error('차트 가져오다가 에러남:', err)
        }
    },

    // 차트 항목마다 `songId`(Song._id)를 **제자리에서** 붙인다 → 뒤이은 updateChartData 가 그대로 저장.
    // 찾거나 만드는 김에 얻는 값이라 추가 쿼리가 없다.
    // 중복키(11000)는 Netlify 재호출로 겹쳐 돈 다른 실행이 방금 같은 곡을 넣은 것 → 그 곡을 다시 찾아 쓴다.
    saveSongData: async (chartData) => {
        for (const song of chartData) {
            const existingSong = await db.Song.findOne({ title: song.title, artist: song.artist }).select('_id')
            if (existingSong) {
                song.songId = existingSong._id
                continue
            }
            try {
                const created = await db.Song.create(song)
                song.songId = created._id
                console.log(`새로운 곡 저장: ${song.title} by ${song.artist}`)
            } catch (err) {
                if (err.code !== 11000) throw err
                const raced = await db.Song.findOne({ title: song.title, artist: song.artist }).select('_id')
                song.songId = raced._id
            }
        }
    },

    updateYoutubeUrls: async (startedAt = Date.now()) => {
        try {
            // 대상 전체를 한 번에 가져오지 않는다. 백로그가 수천 곡이면 쿼리부터 무거워진다.
            // youtubeCheckedAt 제외 — 안 그러면 못 찾는 곡이 매일 앞을 막는다(가사와 같은 병).
            const songs = await db.Song.find({
                youtubeUrl: { $in: [null, ''] },
                youtubeCheckedAt: { $exists: false },
                youtubeGatedAt: { $exists: false },
            })
                .sort(CRON_ORDER)
                .limit(40)
            let filled = 0, closed = 0, gated = 0, failed = 0, budgetHit = false

            for (const song of songs) {
                if (overBudget(startedAt)) {
                    console.log(`시간 예산 도달 — ${filled + closed}곡 처리하고 중단(나머지는 다음 실행에서)`)
                    budgetHit = true
                    break
                }
                try {
                    const searchQuery = youtubeQuery(song.title, song.artist)
                    const searchResults = await searchYoutube(searchQuery)
                    const hadResults = searchResults.items.length > 0

                    let foundSuitableVideo = false

                    if (hadResults) {
                        for (const item of searchResults.items) {
                            const durationInSeconds = parseSimpleTextDuration(item.length.simpleText)

                            if (durationInSeconds === null) {
                                console.log('길이 파싱 못함', item.title)
                                continue
                            }

                            if (durationFits(song.duration, durationInSeconds)) {
                                const videoId = item.id
                                const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`

                                await song.updateOne({ youtubeUrl })
                                console.log(`YouTube URL 업데이트: ${song.title} by ${song.artist}`)
                                foundSuitableVideo = true
                                break
                            }
                        }
                    }

                    if (foundSuitableVideo) {
                        filled++
                    } else if (hadResults) {
                        // 검색은 됐는데 길이 조건에 맞는 게 없는 곡. 매일 같은 결과이니 마커로 닫는다.
                        console.log(`YouTube URL 결과 없음: ${song.title} by ${song.artist}`)
                        await song.updateOne({ youtubeCheckedAt: new Date() })
                        closed++
                    } else if (searchResults.gated) {
                        console.log(`YouTube 연령 게이트: ${song.title} by ${song.artist}`)
                        await song.updateOne({ youtubeGatedAt: new Date() })
                        gated++
                    } else {
                        // 아이템 0개 = 유튜브가 예외 대신 빈 결과로 조용히 막았을 수 있다.
                        // 여기서 마커를 찍으면 멀쩡한 곡을 "영상 없음"으로 영구 오염시키므로,
                        // 닫지 않고 실패로 세어 다음 실행에서 재시도한다(fill-youtube.js 와 같은 방어).
                        failed++
                    }

                    // YouTube API 제한을 고려한 딜레이
                    await new Promise(resolve => setTimeout(resolve, 1000))
                } catch (searchErr) {
                    failed++
                    console.error('유튜브 검색하다 에러남:', searchErr)
                }
            }
            console.log(`YouTube URL 업데이트: ${filled}곡 채움 | ${closed}곡 없음확정 | ${gated}곡 연령게이트 | ${failed}곡 실패`)
            return { target: songs.length, filled, closed, gated, failed, budgetHit }
        } catch (err) {
            console.error('YouTube URL 업데이트 중 오류 발생:', err)
            throw err // 삼키면 크론 기록이 ok 로 남는다
        }
    },

    updateYoutubeUrl: async (_id) => {
        try {
            const song = await db.Song.findById(_id)
            if (song.youtubeGatedAt) return undefined // 연령 게이트 — 다시 검색해도 같다. 관리자가 채운다
            const searchQuery = youtubeQuery(song.title, song.artist)
            const searchResults = await searchYoutube(searchQuery)

            let foundSuitableVideo = false
            let youtubeUrl

            if (searchResults.gated) {
                await song.updateOne({ youtubeGatedAt: new Date() })
                console.log(`YouTube 연령 게이트: ${song.title} by ${song.artist}`)
            } else if (searchResults.items.length > 0) {
                for (const item of searchResults.items) {
                    const durationInSeconds = parseSimpleTextDuration(item.length.simpleText)

                    if (durationInSeconds === null) {
                        console.log('길이 파싱 못함', item.title)
                        continue
                    }

                    if (durationFits(song.duration, durationInSeconds)) {
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
            const searchResults = await searchYoutube(query, 5)
            let youtubeUrls = [];

            // 관리자 화면의 서버 검색도 같은 게이트에 막힌다 — 직접 찾아 붙여 넣으라고 알린다
            if (searchResults.gated) {
                return {
                    success: false,
                    gated: true,
                    message: '유튜브가 연령 인증을 요구해 검색이 막혔어요. 로그인한 유튜브에서 직접 찾아 주소를 붙여 넣으세요.',
                    results: []
                }
            }

            if (searchResults.items.length > 0) {
                for (const item of searchResults.items) {
                    if (!item.length?.simpleText) continue

                    // 🔴 길이로 거르지 않는다 — 여기는 **관리자가 눈으로 보고 고르는** 화면이다.
                    // 예전엔 크론과 같은 2~6분 상한이 걸려 있어서 6분 넘는 곡(`Mandrake` 6:09)은
                    // 손으로 찾으려 해도 후보에 아예 안 떴다. 자동 판정(크론/lazy fill)은
                    // durationFits 로 좁히지만, 사람이 판단하는 자리에서는 넓게 보여준다.
                    // 길이는 `duration` 으로 같이 내려주니 화면에서 보고 판단하면 된다.
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
            const song = await db.Song.findById(id).select('lyrics adult detailLink lyricsCheckedAt duration')
            if (!song) return { lyrics: '', adult: false }
            if (song.lyrics) return { lyrics: song.lyrics, adult: !!song.adult }

            // 아래는 전부 "긁어봐야 소용없는" 경우 — 요청을 아낀다.
            // 19금은 성인 인증이 있어야 보이므로 눌릴 때마다 시도하면 벅스만 때린다.
            if (song.adult) return { lyrics: '', adult: true }
            // 이미 "찾아봤는데 없더라"로 닫힌 곡
            if (song.lyricsCheckedAt) return { lyrics: '', adult: false }
            if (!song.detailLink) return { lyrics: '', adult: false }

            // 크론과 같은 함수를 쓴다 — 이 페이지에 길이도 있어서 **요청 없이** 같이 채운다.
            // 재생 시점이라 지연에 민감한데, 요청 수가 그대로라 비용이 안 늘어난다.
            const detail = await helper.getTrackDetail(song.detailLink)
            // null = 네트워크 실패. 마커를 안 찍어야 크론이 나중에 다시 시도한다.
            if (detail === null) return { lyrics: '', adult: false }

            const { lyrics, duration } = detail
            const durationPatch = (duration != null && song.duration == null) ? { duration } : {}

            await db.Song.updateOne(
                { _id: id },
                lyrics
                    ? { lyrics, lyricsCheckedAt: new Date(), ...durationPatch }
                    : { lyricsCheckedAt: new Date(), ...durationPatch },
            )
            return { lyrics: lyrics || '', adult: false }
        } catch (err) {
            console.error(err)
            return { lyrics: '', adult: false }
        }
    },

    /**
     * 차트에 오른 곡들에 등장 시각/횟수를 기록한다. 크론 우선순위(`lastChartedAt`)와
     * 추천 신호(`chartHits`)가 여기서 나온다. `saveSongData` 다음에 불러야 신곡도 포함된다(songId 필요).
     * 100곡을 순차 update 하면 30초 예산이 아까우므로 bulkWrite 한 방으로 처리한다.
     *
     * **곡당 하루 1회만 센다**(KST 기준). Netlify 가 같은 크론을 최대 3번 겹쳐 부르는데(재시도),
     * 예전엔 그때마다 +1 해서 chartHits 가 ~3배로 부풀었다(2026-11-04 발견, 기존 값은 보정 안 함).
     * 필터 조건이라 문서 단위로 원자적 → 겹친 실행끼리 락 없이도 한 번만 먹힌다.
     * 부수 효과: 국내·해외 차트에 같이 오른 곡도 하루 1회로 센다.
     * 돌려주는 값 = 실제로 센 곡 수(재호출분이면 0).
     */
    markCharted: async (chartData) => {
        const now = new Date()
        const KST_MS = 9 * 3600e3
        const DAY_MS = 86400e3
        const todayKst = new Date(Math.floor((now.getTime() + KST_MS) / DAY_MS) * DAY_MS - KST_MS)
        const ops = chartData.map(song => ({
            updateOne: {
                filter: {
                    _id: song.songId,
                    $or: [{ lastChartedAt: { $lt: todayKst } }, { lastChartedAt: null }],
                },
                update: { $set: { lastChartedAt: now }, $inc: { chartHits: 1 } },
            },
        }))
        if (!ops.length) return 0
        const res = await db.Song.bulkWrite(ops, { ordered: false })
        console.log(`차트 등장 기록: ${res.modifiedCount}곡`)
        return res.modifiedCount
    },

    searchSong: async (query, type, page = 1, limit = 20) => {
        const skip = (page - 1) * limit;

        // 전체·제목·가수·앨범 = 새 검색 엔진(초성·한영 자판·오타·자동 별칭·정확도순, 2026-11-08 — docs/SEARCH.md).
        // 응답 모양 {items, total, hasMore}는 그대로라 앱(dibe2-app)은 수정 없이 결과만 좋아진다.
        // 가사·연령 게이트(관리자)는 아래 예전 정규식 방식
        if (searchService.FIELDS_BY_TYPE[type || 'all'] && String(query || '').trim()) {
            const { items: hits, total, fuzzy } = await searchService.search(query, type || 'all')
            const pageIds = hits.slice(skip, skip + limit).map((h) => h.id)
            const docs = await db.Song.find({ _id: { $in: pageIds } }).select('-__v').lean()
            const byId = new Map(docs.map((d) => [String(d._id), d]))
            const items = pageIds.map((id) => byId.get(String(id))).filter(Boolean) // 색인 후 지워진 곡은 빠진다
            return { items, total, hasMore: skip + pageIds.length < total, fuzzy }
        }
        const flexibleRegex = createFlexibleRegex(query);
        let searchCriteria;

        if (type === 'all') {
            // 공백으로 나눈 각 토큰이 title 또는 artist 어디에 걸리든 통과(토큰 간 AND).
            // "아이유 좋은날"처럼 가수(artist)+제목(title)이 다른 필드로 나뉘어 있어도 잡는다.
            // 단일 토큰이면 $and:[{$or:[…]}]라 기존 $or과 결과가 완전히 같다.
            const tokens = query.trim().split(/\s+/).filter(Boolean);
            searchCriteria = tokens.length
                ? {
                    $and: tokens.map((t) => {
                        const rx = createFlexibleRegex(t);
                        return { $or: [{ title: { $regex: rx } }, { artist: { $regex: rx } }] };
                    })
                }
                : {
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
        } else if (type === 'ytgated') {
            // 관리자 "연령 게이트" 필터 — 유튜브 주소를 손으로 넣어야 하는 곡. 검색어는 있으면 좁히는 용도
            searchCriteria = { youtubeGatedAt: { $exists: true }, youtubeUrl: { $in: [null, ''] } };
            if (query && query.trim()) {
                searchCriteria.$or = [{ title: { $regex: flexibleRegex } }, { artist: { $regex: flexibleRegex } }];
            }
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

    updateLyrics: async (startedAt = Date.now()) => {
        try {
            const songs = await db.Song.find(LYRICS_PENDING)
                .sort(CRON_ORDER)
                .limit(120)
            let processed = 0, closed = 0, failed = 0, budgetHit = false

            for (const song of songs) {
                if (overBudget(startedAt)) {
                    console.log(`시간 예산 도달 — ${processed}곡 처리하고 중단(나머지는 다음 실행에서)`)
                    budgetHit = true
                    break
                }
                try {
                    // 같은 페이지에서 길이도 딸려온다(요청 0회 추가). 유튜브 매칭이 이 값을 쓴다.
                    const detail = await helper.getTrackDetail(song.detailLink)

                    // null = 네트워크/파싱 실패. 마커를 찍지 않아야 다음 실행에서 재시도된다.
                    if (detail === null) { failed++; continue }

                    const { lyrics, duration } = detail
                    // 길이는 가사와 독립이다 — 가사가 없는 곡도 길이는 저장한다.
                    const durationPatch = (duration != null && song.duration == null) ? { duration } : {}

                    // '' = 페이지는 멀쩡한데 가사가 원래 없는 곡. 여기서 닫지 않으면 영원히 재시도한다.
                    if (!lyrics) {
                        await song.updateOne({ lyricsCheckedAt: new Date(), ...durationPatch })
                        closed++
                        continue
                    }

                    await song.updateOne({ lyrics, lyricsCheckedAt: new Date(), ...durationPatch })
                    processed++
                } catch (err) {
                    failed++
                    console.error(`가사 업데이트 에러: ${song.title} by ${song.artist}`)
                }
            }
            console.log(`가사 업데이트: ${processed}곡 채움 | ${closed}곡 "가사 없음"으로 닫음 | ${failed}곡 실패`)
            return { target: songs.length, filled: processed, closed, failed, budgetHit }
        } catch (err) {
            console.error('가사 업데이트 중 에러: ', err)
            throw err
        }
    },

    /**
     * 장르/스타일 채우기. 곡 저장(cron-chart)과 분리한 이유:
     * 앨범 요청이 cron-chart 안에 있으면 신곡이 많은 날 30초를 넘겨 **곡 저장 자체가 실패**한다.
     * 가사/유튜브와 같은 "저장 먼저, 필드는 나중에" 패턴을 따른다.
     */
    updateGenres: async (startedAt = Date.now()) => {
        try {
            // genre 필드가 아예 없는 문서만. 빈 배열([])은 "찾아봤는데 없더라"라 재시도하지 않는다.
            const songs = await db.Song.find({ genre: { $exists: false }, coverUrl: { $ne: null } })
                .sort(CRON_ORDER)
                .limit(120)
            let processed = 0, failed = 0, budgetHit = false

            // 같은 앨범 곡은 값이 같다. 한 번의 실행 안에서만이라도 캐시하면 요청이 준다.
            const cache = new Map()

            for (const song of songs) {
                if (overBudget(startedAt)) {
                    console.log(`시간 예산 도달 — ${processed}곡 처리하고 중단(나머지는 다음 실행에서)`)
                    budgetHit = true
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
                    if (!info) { failed++; continue } // 네트워크 실패 — 다음 실행에서 재시도

                    await song.updateOne({ genre: info.genre, style: info.style })
                    processed++
                } catch (err) {
                    failed++
                    console.error(`장르 업데이트 에러: ${song.title} by ${song.artist}`)
                }
            }
            console.log(`장르 업데이트: ${processed}곡 처리 | ${failed}곡 실패 (앨범 요청 ${cache.size}회)`)
            return { target: songs.length, filled: processed, failed, budgetHit }
        } catch (err) {
            console.error('장르 업데이트 중 에러: ', err)
            throw err
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
            // 관리자가 유튜브 주소를 넣으면 연령 게이트·없음 표시를 지운다(크론·즉석 채우기가 다시 건드리지 않게 하던 표시)
            // (폼이 곡 객체를 통째로 보내면 같은 필드를 $set·$unset 하게 돼 Mongo 가 거부하므로 먼저 뺀다)
            let update = updateData
            if (updateData && updateData.youtubeUrl) {
                const { youtubeGatedAt, youtubeCheckedAt, ...rest } = updateData
                update = { ...rest, $unset: { youtubeGatedAt: 1, youtubeCheckedAt: 1 } }
            }
            const updatedSong = await db.Song.findByIdAndUpdate(songId, update, { new: true })
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