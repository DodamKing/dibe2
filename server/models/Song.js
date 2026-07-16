const mongoose = require('mongoose')

const songSchema = new mongoose.Schema({
    title: { type: String, trim: true },
    artist: { type: String, trim: true },
    album: { type: String, trim: true },
    coverUrl: { type: String, trim: true },
    detailLink: { type: String, trim: true },
    lyrics: { type: String, trim: true },
    youtubeUrl : { type: String, trim: true },
    // 벅스 19금 배지. 해당 곡은 성인 인증(로그인)이 있어야 가사가 보이므로 **크롤링으로 못 받는다**.
    // 가사를 못 받은 게 아니라 원래 안 주는 곡이라, 재시도 대상에서 빼고 UI에도 그렇게 표시한다.
    adult: { type: Boolean, default: false },
    /**
     * "찾아봤는데 없더라"를 기록하는 마커. **영구 실패에만** 찍는다.
     *
     * 이게 없으면 못 받는 곡이 매일 재시도된다(실측: 6곡이 567일째 재시도 중이었음).
     * 백로그가 커지면 치명적이다 — 크론은 22초에 80곡을 도는데 **못 받는 곡 80개가 앞을 막으면
     * 매일 그것만 하고 끝난다**(head-of-line). 뒤쪽 진짜 곡엔 영원히 도달 못 한다.
     *
     * 네트워크 실패와 구분해야 한다: `helper.getLyrics` 는 실패면 `null`, 가사가 원래 없으면 `''`
     * 를 준다. `''` 일 때만 찍으면 네트워크 실패는 마커가 없어 자연히 다음 실행에서 재시도된다.
     * (`genre: []` 로 닫는 updateGenres 와 같은 패턴)
     */
    lyricsCheckedAt: { type: Date },
    youtubeCheckedAt: { type: Date },
    /**
     * 마지막으로 차트에 등장한 시각. 크론의 **우선순위 정렬 키**다.
     *
     * 크론에 정렬이 없으면 자연순(≈ _id, 오래된 삽재분부터)이라, 대량 적재분이 앞을 막아
     * **오늘 차트에 오른 신곡이 몇 달 뒤에나 처리된다**. 가사는 lazy fill 이 있어 그나마 낫지만
     * 장르는 lazy 가 불가능해서(추천이 곡을 누르기 전에 장르로 후보를 고른다) 신곡이 추천에서 통째로 빠진다.
     */
    lastChartedAt: { type: Date },
    // 차트에 몇 번 등장했나 = 인기 신호(추천 콜드스타트). 차트 크론이 매일 $inc 한다.
    // 적재분은 수집한 과거 차트(2019-10~)의 등장 횟수로 초기값을 넣는다.
    chartHits: { type: Number, default: 0 },
    // 벅스는 장르를 트랙이 아니라 앨범에 붙인다. 같은 앨범 곡은 값이 같다.
    genre: { type: [String], default: undefined },
    style: { type: [String], default: undefined },
    // 집계 캐시. 원본은 Like / PlayEvent 컬렉션이고 여기 값은 $inc로 함께 갱신한다.
    // 목록 응답마다 count 쿼리를 도는 걸 피하려는 비정규화.
    likeCount: { type: Number, default: 0, min: 0 },
    playCount: { type: Number, default: 0, min: 0 },
}, { timestamps: true })

songSchema.index({ genre: 1 })
songSchema.index({ likeCount: -1 })
songSchema.index({ playCount: -1 })
// 크론이 "차트에 최근 오른 곡"부터 처리하려고 매번 정렬한다. 곡이 만 단위라 인덱스 없이는 느리다.
songSchema.index({ lastChartedAt: -1 })

module.exports = mongoose.model('Song', songSchema )