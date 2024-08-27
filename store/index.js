// store/index.js
import Vue from 'vue'
import Vuex from 'vuex'

Vue.use(Vuex)

// 더미 데이터
const dummyData = {
    myPlaylists: [
        { id: 1, name: '즐겨듣는 노래', imageUrl: 'https://via.placeholder.com/150?text=Playlist1' },
        { id: 2, name: '출근길 플레이리스트', imageUrl: 'https://via.placeholder.com/150?text=Playlist2' },
        { id: 3, name: '운동할 때 듣는 음악', imageUrl: 'https://via.placeholder.com/150?text=Playlist3' },
    ],
    popularSongs: [
        { id: 1, name: '인기곡 A', artist: '아티스트 X', imageUrl: 'https://via.placeholder.com/150?text=Song1' },
        { id: 2, name: '최신 히트 B', artist: '아티스트 Y', imageUrl: 'https://via.placeholder.com/150?text=Song2' },
        { id: 3, name: '트렌딩 C', artist: '아티스트 Z', imageUrl: 'https://via.placeholder.com/150?text=Song3' },
    ],
    recommendedPlaylists: [
        { id: 1, name: '2024년 여름 히트곡', imageUrl: 'https://via.placeholder.com/150?text=Recommended1' },
        { id: 2, name: '칠아웃 라운지', imageUrl: 'https://via.placeholder.com/150?text=Recommended2' },
        { id: 3, name: '운동 동기부여', imageUrl: 'https://via.placeholder.com/150?text=Recommended3' },
    ],
    newReleases: [
        { id: 1, name: '새 앨범', artist: '아티스트 A', imageUrl: 'https://via.placeholder.com/150?text=Album1' },
        { id: 2, name: '싱글', artist: '아티스트 B', imageUrl: 'https://via.placeholder.com/150?text=Album2' },
        { id: 3, name: 'EP', artist: '아티스트 C', imageUrl: 'https://via.placeholder.com/150?text=Album3' },
    ],
    genres: ['팝', '록', '힙합', 'R&B', '클래식', '재즈', '일렉트로닉', '컨트리'],
    events: [
        { id: 1, name: '가상 콘서트: 아티스트 X', date: '2024-09-15', imageUrl: 'https://via.placeholder.com/150?text=Event1' },
        { id: 2, name: '음악 페스티벌 2024', date: '2024-10-01', imageUrl: 'https://via.placeholder.com/150?text=Event2' },
        { id: 3, name: '팬 미팅: 아티스트 Y', date: '2024-08-30', imageUrl: 'https://via.placeholder.com/150?text=Event3' },
    ]
}

// 더미 API 함수
export const state = () => ({
    currentTrack: null,
    isPlaying: false,
    volume: 1,
    currentTime: 0,
    duration: 0,
    isRepeat: false,
    isShuffle: false,
    queue: [],
    myPlaylists: dummyData.myPlaylists,
    popularSongs: dummyData.popularSongs,
    recommendedPlaylists: dummyData.recommendedPlaylists,
    newReleases: dummyData.newReleases,
    genres: dummyData.genres,
    events: dummyData.events
})

export const mutations = {
    setCurrentTrack(state, track) {
        state.currentTrack = track
    },
    setIsPlaying(state, isPlaying) {
        state.isPlaying = isPlaying
    },
    setVolume(state, volume) {
        state.volume = volume
    },
    setCurrentTime(state, time) {
        state.currentTime = time
    },
    setDuration(state, duration) {
        state.duration = duration
    },
    toggleRepeat(state) {
        state.isRepeat = !state.isRepeat
    },
    toggleShuffle(state) {
        state.isShuffle = !state.isShuffle
    },
    setQueue(state, queue) {
        state.queue = queue
    }
}

export const actions = {
    playTrack({ commit, state }, track) {
        commit('setCurrentTrack', track)
        commit('setIsPlaying', true)
        // 실제로는 여기서 오디오 재생 로직을 추가해야 합니다
    },
    pauseTrack({ commit }) {
        commit('setIsPlaying', false)
        // 실제로는 여기서 오디오 일시정지 로직을 추가해야 합니다
    },
    nextTrack({ commit, state }) {
        const currentIndex = state.queue.findIndex(track => track.id === state.currentTrack.id)
        const nextTrack = state.queue[(currentIndex + 1) % state.queue.length]
        commit('setCurrentTrack', nextTrack)
        // 실제로는 여기서 다음 트랙 재생 로직을 추가해야 합니다
    },
    previousTrack({ commit, state }) {
        const currentIndex = state.queue.findIndex(track => track.id === state.currentTrack.id)
        const previousTrack = state.queue[(currentIndex - 1 + state.queue.length) % state.queue.length]
        commit('setCurrentTrack', previousTrack)
        // 실제로는 여기서 이전 트랙 재생 로직을 추가해야 합니다
    },
    updateVolume({ commit }, volume) {
        commit('setVolume', volume)
        // 실제로는 여기서 볼륨 조절 로직을 추가해야 합니다
    },
    updateCurrentTime({ commit }, time) {
        commit('setCurrentTime', time)
    },
    updateDuration({ commit }, duration) {
        commit('setDuration', duration)
    },
    toggleRepeat({ commit }) {
        commit('toggleRepeat')
    },
    toggleShuffle({ commit }) {
        commit('toggleShuffle')
    },
    addToQueue({ commit, state }, track) {
        const newQueue = [...state.queue, track]
        commit('setQueue', newQueue)
    }
}

export const getters = {
    getCurrentTrack: state => state.currentTrack,
    getIsPlaying: state => state.isPlaying,
    getVolume: state => state.volume,
    getCurrentTime: state => state.currentTime,
    getDuration: state => state.duration,
    getIsRepeat: state => state.isRepeat,
    getIsShuffle: state => state.isShuffle,
    getQueue: state => state.queue,
    getMyPlaylists: state => state.myPlaylists,
    getPopularSongs: state => state.popularSongs,
    getRecommendedPlaylists: state => state.recommendedPlaylists,
    getNewReleases: state => state.newReleases,
    getGenres: state => state.genres,
    getEvents: state => state.events
}

export default () => {
    return new Vuex.Store({
        state,
        mutations,
        actions,
        getters
    })
}