<template>
    <div>
        <!-- 검색창: 풀폭 sticky (헤더 바로 아래, 헤더 height=64px에 맞춰 top-16).
             container 클래스는 쓰지 않음 — layouts/main.vue 전역 .container { overflow-x: hidden }이
             sticky의 scroll ancestor로 잡혀버려서 page scroll에 따라가지 못함 -->
        <div class="sticky top-16 z-20 bg-gray-900/95 backdrop-blur-sm">
            <div class="max-w-7xl mx-auto px-4 pt-3">
                <div class="flex items-center gap-2">
                    <button v-for="tab in tabs" :key="tab.key" @click="activeTab = tab.key"
                        :class="['px-4 py-2 rounded-full text-sm font-medium transition',
                            activeTab === tab.key ? 'bg-white text-gray-900' : 'bg-white bg-opacity-10 text-gray-300 hover:bg-opacity-20']">
                        {{ tab.label }}
                    </button>
                </div>
            </div>
            <div v-if="activeTab === 'search'" class="max-w-7xl mx-auto px-4 py-3">
                <div class="relative">
                    <input v-model="query" @keyup.enter="search" type="text" placeholder="유튜브에서 검색..."
                        class="w-full bg-white bg-opacity-10 text-white placeholder-gray-400 rounded-full py-3 pl-5 pr-14 focus:outline-none focus:ring-2 focus:ring-white focus:bg-opacity-20 text-base">
                    <button @click="search" aria-label="검색"
                        class="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-gray-300 hover:text-white">
                        <i class="fas fa-search"></i>
                    </button>
                </div>
            </div>
        </div>

        <!-- 탭 콘텐츠: 검색 결과 또는 보관함. "지금 재생 중" 영상은 여기에 포함되지 않음.
             하단 고정 미니플레이어가 떠 있을 때는 가려지지 않게 여백 추가 -->
        <div class="max-w-screen-2xl mx-auto px-4 pt-4 sm:pt-6 pb-4 sm:pb-6" :class="{ 'pb-24 sm:pb-28': currentVideo }">

            <template v-if="activeTab === 'search'">
                <!-- 로딩 -->
                <div v-if="loading" class="text-center py-8 text-gray-300">
                    <i class="fas fa-spinner fa-spin text-2xl"></i>
                </div>

                <!-- 결과 그리드 (모바일 1열 → sm 2열 → lg 3열 → xl 이상 4열) -->
                <div v-if="!loading && results.length > 0"
                    class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                    <div v-for="item in results" :key="item.id" class="relative">
                        <button @click="playItem(item)"
                            class="text-left w-full bg-white bg-opacity-5 hover:bg-opacity-10 rounded-lg overflow-hidden transition focus:outline-none focus:ring-2 focus:ring-white"
                            :class="{ 'ring-2 ring-purple-400': currentVideo && currentVideo.id === item.id }">
                            <div class="aspect-video bg-black relative">
                                <img :src="item.thumbnail" :alt="item.title" class="w-full h-full object-cover" loading="lazy">
                                <span v-if="item.duration"
                                    class="absolute bottom-1 right-1 bg-black bg-opacity-80 text-xs px-1.5 py-0.5 rounded">
                                    {{ item.duration }}
                                </span>
                            </div>
                            <div class="p-3">
                                <h3 class="font-medium text-sm sm:text-base leading-snug line-clamp-2">{{ item.title }}</h3>
                                <p class="text-xs text-gray-400 mt-1 truncate">{{ item.channelTitle }}</p>
                            </div>
                        </button>
                        <button @click.stop="openAddModal(item)" aria-label="추가" title="추가"
                            class="absolute top-2 right-2 z-10 w-8 h-8 flex items-center justify-center bg-black bg-opacity-60 hover:bg-opacity-80 rounded-full text-white">
                            <i class="fas fa-plus text-sm"></i>
                        </button>
                    </div>
                </div>

                <!-- 빈 상태 -->
                <div v-if="!loading && hasSearched && results.length === 0" class="text-center py-12 text-gray-400">
                    검색 결과가 없습니다.
                </div>
                <div v-if="!hasSearched && results.length === 0" class="text-center py-12 text-gray-500 text-sm">
                    검색어를 입력해주세요.
                </div>
            </template>

            <template v-else>
                <VideoPlaylistDetailPanel v-if="selectedPlaylistId" :playlist-id="selectedPlaylistId"
                    @back="selectedPlaylistId = null" @play-all="showNowPlaying = true" />
                <MyVideoPlaylistSection v-else :playlists="playlists" @create-playlist="showCreatePlaylistModal = true"
                    @delete-playlist="handleDeletePlaylist" @select-playlist="selectedPlaylistId = $event" />
            </template>
        </div>

        <!-- 지금 재생 중 미니플레이어: 음원 MusicPlayer.vue와 동일하게 하단 고정. 탭과 무관하게 항상 떠 있음
             (검색/보관함 탭 콘텐츠와는 완전히 분리되어 있고, 탭을 눌러도 사라지지 않음 — 영상은 계속 재생됨).
             "지금 재생 중" 패널보다 z-index가 높아야 패널이 열려 있어도 재생목록 토글 버튼을 계속 누를 수 있음 -->
        <div v-if="currentVideo" class="fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-r from-purple-800 to-blue-700 shadow-lg">
            <div class="max-w-7xl mx-auto px-4 py-2 flex items-center gap-2">
                <button @click="toggleTrackInfo" class="flex items-center gap-2 flex-grow min-w-0 text-left">
                    <img :src="currentVideo.thumbnail" :alt="currentVideo.title"
                        class="w-12 h-8 sm:w-14 sm:h-9 object-cover rounded flex-shrink-0">
                    <p class="text-sm font-medium truncate hidden sm:block">{{ currentVideo.title }}</p>
                </button>
                <div class="flex items-center flex-shrink-0">
                    <button @click="toggleRepeat" aria-label="반복 재생" :title="repeatTitle"
                        class="w-9 h-9 flex items-center justify-center text-gray-200 hover:text-white relative">
                        <i class="fas fa-repeat text-sm" :class="{ 'text-green-300': repeatMode !== 'off' }"></i>
                        <span v-if="repeatMode === 'one'" class="absolute bottom-1 right-1.5 text-[8px] font-bold leading-none text-green-300">1</span>
                    </button>
                    <button @click="playPrevious" :disabled="!hasPreviousVideo" aria-label="이전 영상"
                        class="w-9 h-9 flex items-center justify-center text-gray-200 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed">
                        <i class="fas fa-step-backward text-sm"></i>
                    </button>
                    <button @click="togglePlay" aria-label="재생/일시정지"
                        class="bg-white text-purple-800 rounded-full w-8 h-8 flex items-center justify-center hover:bg-gray-100 focus:outline-none mx-1">
                        <i :class="['fas', isPlaying ? 'fa-pause' : 'fa-play', isPlaying ? '' : 'ml-0.5']"></i>
                    </button>
                    <button @click="playNext" :disabled="!hasNextVideo" aria-label="다음 영상"
                        class="w-9 h-9 flex items-center justify-center text-gray-200 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed">
                        <i class="fas fa-step-forward text-sm"></i>
                    </button>
                    <button @click="toggleShuffle" aria-label="셔플" :title="shuffleOn ? '셔플 끄기' : '셔플 켜기'"
                        class="w-9 h-9 flex items-center justify-center text-gray-200 hover:text-white">
                        <i class="fas fa-shuffle text-sm" :class="{ 'text-green-300': shuffleOn }"></i>
                    </button>
                    <div class="hidden sm:flex items-center space-x-1 mx-1">
                        <button @click="toggleMute" aria-label="음소거" class="text-gray-200 hover:text-white focus:outline-none">
                            <i :class="['fas', (muted || volume === 0) ? 'fa-volume-mute' : volume < 50 ? 'fa-volume-down' : 'fa-volume-up']"></i>
                        </button>
                        <div class="relative w-16 h-1">
                            <div class="absolute inset-y-0 left-0 bg-gray-600 bg-opacity-50 rounded-full w-full h-1"></div>
                            <div class="absolute inset-y-0 left-0 bg-white rounded-full h-1" :style="{ width: (muted ? 0 : volume) + '%' }"></div>
                            <input type="range" min="0" max="100" step="1" :value="muted ? 0 : volume" @input="onVolumeChange"
                                class="w-full appearance-none bg-transparent h-1 rounded-full focus:outline-none absolute inset-0 opacity-0">
                        </div>
                    </div>
                    <button @click="showNowPlaying = !showNowPlaying" aria-label="재생목록" title="재생목록"
                        class="w-9 h-9 flex items-center justify-center text-gray-200 hover:text-white">
                        <i class="fas fa-list text-sm"></i>
                    </button>
                </div>
            </div>

            <!-- 진행바(음원 MusicPlayer.vue와 동일 패턴): 시간표시 + 드래그 탐색 -->
            <div class="max-w-7xl mx-auto px-4 pb-2 flex items-center space-x-2 text-xs text-gray-200">
                <span class="w-8 text-right">{{ formatTime(currentTime) }}</span>
                <div class="flex-1 relative group" @mousedown="startSeek" @mousemove="updateSeek" @mouseup="endSeek"
                    @mouseleave="endSeek" @touchstart="startSeek" @touchmove="updateSeek" @touchend="endSeek">
                    <div class="absolute inset-y-0 left-0 bg-gray-600 bg-opacity-50 rounded-full w-full h-1 group-hover:h-2 transition-all duration-200"></div>
                    <div class="absolute inset-y-0 left-0 bg-white rounded-full transition-all duration-100 ease-out h-1 group-hover:h-2"
                        :style="{ width: `${progress}%` }"></div>
                    <div v-if="isDragging" class="absolute top-0 transform -translate-y-full bg-white text-purple-800 px-1 py-0.5 rounded text-xs"
                        :style="{ left: `${dragProgress}%` }">
                        {{ formatTime(dragTime) }}
                    </div>
                    <input type="range" min="0" :max="duration" :value="currentTime" @input="onSeekChange"
                        class="appearance-none w-full h-1 group-hover:h-2 bg-transparent rounded-full outline-none focus:outline-none active:outline-none absolute inset-0 z-10 opacity-0 cursor-pointer">
                </div>
                <span class="w-8">{{ formatTime(duration) }}</span>
            </div>

            <!-- 모바일 제목 툴팁(음원 MusicPlayer.vue와 동일 패턴): 썸네일 탭 시 잠깐 떴다 5초 후 자동 닫힘 -->
            <div v-if="showTrackInfo" class="absolute bottom-full left-2 mb-2 bg-gray-800 text-white p-2 rounded-lg shadow-lg"
                style="max-width: 240px;">
                <p class="text-sm font-medium" :title="currentVideo.title">{{ currentVideo.title }}</p>
            </div>
        </div>

        <!-- 지금 재생 중 패널: 영상 프레임 + 재생목록만 담당 — 재생 컨트롤(이전/재생/다음/셔플/반복/음량)은 위 고정 바에만
             있고 여기엔 중복으로 두지 않음. 닫기는 우측 상단 화살표가 아니라 고정 바의 "재생목록" 버튼을 다시 누르는 토글 방식.
             v-show라 #video-page-player는 패널이 닫혀 있어도 DOM에 남아있어 재생이 끊기지 않음 -->
        <div v-show="currentVideo && showNowPlaying" class="fixed inset-0 z-30 bg-gray-900 overflow-y-auto">
            <div class="max-w-3xl mx-auto px-4 py-4 pb-24 sm:pb-28">
                <div class="video-frame bg-black rounded-lg overflow-hidden shadow-lg relative">
                    <!-- YouTube IFrame Player (차단 감지 위해 단순 iframe 대신 YT.Player 사용) -->
                    <div v-show="!isBlocked" id="video-page-player" class="w-full h-full"></div>
                    <!-- 차단 감지 시 안내 카드. invidious 우회는 yewtu.be의 anti-bot+X-Frame-Options로 안 됨이 확인됨. -->
                    <div v-if="isBlocked"
                        class="absolute inset-0 flex flex-col items-center justify-center text-center px-6 bg-black">
                        <i class="fas fa-ban text-4xl text-gray-500 mb-3"></i>
                        <p class="text-base sm:text-lg font-semibold mb-2">이 영상은 외부 재생이 차단되어 있어요</p>
                        <p class="text-sm text-gray-400 mb-4 max-w-md">
                            업로더가 다른 사이트 임베드를 막아놓은 영상입니다. YouTube에서 직접 시청해주세요.
                        </p>
                        <a :href="youtubeWatchUrl" target="_blank" rel="noopener"
                            class="inline-flex items-center bg-red-600 hover:bg-red-700 text-white font-medium px-5 py-2.5 rounded-full transition">
                            <i class="fab fa-youtube mr-2"></i>YouTube에서 보기
                        </a>
                    </div>
                </div>
                <div v-if="currentVideo" class="mt-3 px-1">
                    <h2 class="text-base sm:text-lg font-semibold leading-snug">{{ currentVideo.title }}</h2>
                    <p class="text-sm text-gray-400 truncate mt-1">{{ currentVideo.channelTitle }}</p>
                </div>

                <div class="mt-6">
                    <div class="flex items-center justify-between mb-2">
                        <h3 class="text-sm font-semibold text-gray-400">재생목록 ({{ queue.length }})</h3>
                        <button @click="openAddModal(currentVideo)" aria-label="현재 영상 추가" title="현재 영상 추가"
                            class="w-9 h-9 flex items-center justify-center text-gray-300 hover:text-white">
                            <i class="fas fa-plus text-sm"></i>
                        </button>
                    </div>
                    <VideoQueueList />
                </div>
            </div>
        </div>

        <CreateVideoPlaylistModal :show="showCreatePlaylistModal" @close="showCreatePlaylistModal = false"
            @create="handleCreatePlaylist" @show-toast="msg => $toast.error(msg)" />
        <VideoAddModal :show="showAddModal" :video="addModalVideo" @close="showAddModal = false" />
    </div>
</template>

<script>
// 차단 영상은 우회 시도를 안 함. invidious(yewtu.be 등)는 anti-bot + X-Frame-Options로 iframe 임베드 불가,
// 한국 라이선스 영상(TJ 카라오케 등)은 인스턴스 IP 제한으로 stream 추출도 실패하는 게 확인됨.
// 차단 감지 시 깔끔하게 "YouTube에서 보기" 안내로 종결.
import { mapState, mapGetters, mapActions } from 'vuex'
import MyVideoPlaylistSection from '~/components/MyVideoPlaylistSection.vue'
import VideoPlaylistDetailPanel from '~/components/VideoPlaylistDetailPanel.vue'
import CreateVideoPlaylistModal from '~/components/CreateVideoPlaylistModal.vue'
import VideoAddModal from '~/components/VideoAddModal.vue'
import VideoQueueList from '~/components/VideoQueueList.vue'

export default {
    layout: 'video',
    components: {
        MyVideoPlaylistSection, VideoPlaylistDetailPanel, CreateVideoPlaylistModal, VideoAddModal, VideoQueueList
    },
    head() {
        const base = 'DIBE2 비디오'
        return {
            title: this.currentVideo ? `${this.currentVideo.title} - ${base}` : base,
        }
    },
    data() {
        return {
            query: '',
            results: [],
            loading: false,
            hasSearched: false,
            player: null,
            isBlocked: false,
            tabs: [
                { key: 'search', label: '검색' },
                { key: 'library', label: '보관함' },
            ],
            activeTab: 'search',
            showNowPlaying: false,
            selectedPlaylistId: null,
            showCreatePlaylistModal: false,
            showAddModal: false,
            addModalVideo: null,
            volume: 100,
            muted: false,
            previousVolume: null,
            isPlaying: false,
            // 새로고침 등으로 복원된 영상은 자동재생하지 않기 위한 1회성 플래그
            justRestored: false,
            // 마지막으로 보던 영상 1개의 재생 위치만 기억 (여러 영상 기록 누적은 안 함)
            lastPosition: null,
            positionInterval: null,
            // 모바일 제목 툴팁(음원 MusicPlayer.vue toggleTrackInfo와 동일 패턴) 표시 여부
            showTrackInfo: false,
            // 진행바(음원 MusicPlayer.vue와 동일 패턴)
            currentTime: 0,
            duration: 0,
            isDragging: false,
            dragProgress: 0,
            dragTime: 0,
            timeUpdateInterval: null,
        }
    },
    computed: {
        ...mapState('videoQueue', ['currentVideo', 'queue', 'shuffleOn', 'repeatMode']),
        ...mapGetters('videoQueue', ['hasPreviousVideo', 'hasNextVideo']),
        ...mapState('videoPlaylist', ['playlists']),
        youtubeWatchUrl() {
            if (!this.currentVideo) return ''
            return `https://www.youtube.com/watch?v=${this.currentVideo.id}`
        },
        repeatTitle() {
            switch (this.repeatMode) {
                case 'all': return '전체 반복'
                case 'one': return '한 영상 반복'
                default: return '반복 없음'
            }
        },
        progress() {
            return this.duration > 0 ? (this.currentTime / this.duration) * 100 : 0
        },
    },
    watch: {
        isPlaying(newVal) {
            if (newVal) this.startTimeUpdate()
            else this.stopTimeUpdate()
        },
        currentVideo(newVal, oldVal) {
            if (!newVal) return
            this.isBlocked = false
            this.currentTime = 0
            this.duration = 0
            if (!this.player) {
                const autoplay = !this.justRestored
                this.$nextTick(() => this.initVideoPlayer(newVal.id, autoplay))
            } else if (this.player.loadVideoById && (!oldVal || oldVal.id !== newVal.id)) {
                this.player.loadVideoById(newVal.id)
                if (this.lastPosition && this.lastPosition.id === newVal.id && this.lastPosition.time > 5) {
                    this.player.seekTo(this.lastPosition.time, true)
                }
            }
        },
    },
    methods: {
        ...mapActions('videoQueue', ['setCurrentVideo', 'initializeQueue', 'playPrevious', 'toggleShuffle', 'toggleRepeat']),
        ...mapActions('videoPlaylist', ['fetchPlaylists', 'createPlaylist', 'deletePlaylist']),
        playNext() {
            // repeat 'one'은 다음 영상으로 넘기지 않고 현재 영상을 처음부터 재시작 (음원 player.js와 동일 동작).
            // 비디오는 공유 싱글톤이 아니라 페이지 로컬 YT.Player라 store가 아니라 여기서 직접 seekTo 처리.
            if (this.repeatMode === 'one' && this.player) {
                this.player.seekTo(0, true)
                this.player.playVideo()
                return
            }
            this.$store.dispatch('videoQueue/playNext')
        },
        toggleTrackInfo() {
            this.showTrackInfo = !this.showTrackInfo
            if (this.showTrackInfo) {
                setTimeout(() => { this.showTrackInfo = false }, 5000)
            }
        },
        formatTime(seconds) {
            if (isNaN(seconds) || seconds === null) return '00:00'
            const mins = Math.floor(seconds / 60)
            const secs = Math.floor(seconds % 60)
            return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        },
        startSeek(event) {
            this.isDragging = true
            this.updateSeekPosition(event)
        },
        updateSeek(event) {
            if (this.isDragging) this.updateSeekPosition(event)
        },
        endSeek() {
            if (this.isDragging) {
                this.isDragging = false
                this.currentTime = this.dragTime
                if (this.player && this.player.seekTo) this.player.seekTo(this.dragTime, true)
            }
        },
        updateSeekPosition(event) {
            const rect = event.target.getBoundingClientRect()
            const clientX = event.touches ? event.touches[0].clientX : event.clientX
            const x = clientX - rect.left
            this.dragProgress = Math.min(100, Math.max(0, (x / rect.width) * 100))
            this.dragTime = (this.dragProgress / 100) * this.duration
        },
        onSeekChange(event) {
            const time = Number(event.target.value)
            this.currentTime = time
            if (this.player && this.player.seekTo) this.player.seekTo(time, true)
        },
        startTimeUpdate() {
            this.stopTimeUpdate()
            this.timeUpdateInterval = setInterval(() => {
                if (this.player && this.player.getCurrentTime) {
                    this.currentTime = this.player.getCurrentTime()
                    this.duration = this.player.getDuration()
                }
            }, 1000)
        },
        stopTimeUpdate() {
            if (this.timeUpdateInterval) {
                clearInterval(this.timeUpdateInterval)
                this.timeUpdateInterval = null
            }
        },
        async search() {
            const q = this.query.trim()
            if (!q) return
            this.loading = true
            this.hasSearched = true
            try {
                const { items } = await this.$axios.$get('/api/youtube/search', { params: { query: q } })
                this.results = items || []
            } catch (err) {
                console.error('비디오 검색 실패:', err)
                this.results = []
            } finally {
                this.loading = false
            }
        },
        playItem(item) {
            this.setCurrentVideo(item)
            this.showNowPlaying = true
        },
        openAddModal(video) {
            this.addModalVideo = video
            this.showAddModal = true
        },
        togglePlay() {
            if (!this.player) return
            if (this.isPlaying) {
                this.player.pauseVideo()
            } else {
                this.player.playVideo()
            }
        },
        getVolumeStorageKey() {
            if (!this.$store.state.auth.loggedIn) return null
            return `user_${this.$store.state.auth.user.userId}_video_volume`
        },
        saveVolume(value) {
            const key = this.getVolumeStorageKey()
            if (key) localStorage.setItem(key, value)
        },
        getPositionStorageKey() {
            if (!this.$store.state.auth.loggedIn) return null
            return `user_${this.$store.state.auth.user.userId}_video_position`
        },
        savePosition() {
            if (!this.player || !this.currentVideo || !this.player.getCurrentTime) return
            const key = this.getPositionStorageKey()
            if (!key) return
            localStorage.setItem(key, JSON.stringify({ id: this.currentVideo.id, time: this.player.getCurrentTime() }))
        },
        onVolumeChange(event) {
            const v = Number(event.target.value)
            this.volume = v
            this.muted = v === 0
            if (this.player && this.player.setVolume) this.player.setVolume(v)
            this.saveVolume(v)
        },
        toggleMute() {
            if (!this.player) return
            if (this.muted || this.volume === 0) {
                this.muted = false
                this.volume = this.previousVolume || 50
                if (this.player.unMute) this.player.unMute()
                if (this.player.setVolume) this.player.setVolume(this.volume)
            } else {
                this.previousVolume = this.volume
                this.muted = true
                if (this.player.mute) this.player.mute()
            }
            this.saveVolume(this.muted ? 0 : this.volume)
        },
        async handleCreatePlaylist(name) {
            try {
                await this.createPlaylist(name)
                this.showCreatePlaylistModal = false
                this.$toast.success('플레이리스트가 생성되었습니다.')
            } catch (err) {
                this.$toast.error('플레이리스트 생성에 실패했습니다.')
            }
        },
        async handleDeletePlaylist(playlistId) {
            await this.deletePlaylist(playlistId)
            if (this.selectedPlaylistId === playlistId) this.selectedPlaylistId = null
        },
        initVideoPlayer(videoId, autoplay = true) {
            if (this.player) return
            const create = () => {
                this.player = new YT.Player('video-page-player', {
                    host: 'https://www.youtube-nocookie.com',
                    videoId,
                    playerVars: {
                        autoplay: autoplay ? 1 : 0,
                        rel: 0,
                        playsinline: 1,
                    },
                    events: {
                        onReady: () => {
                            if (this.player && this.player.setVolume) this.player.setVolume(this.volume)
                            if (this.lastPosition && this.lastPosition.id === videoId && this.lastPosition.time > 5) {
                                this.player.seekTo(this.lastPosition.time, true)
                                // YouTube IFrame API 특성: cue(autoplay:0)만 된 영상에 seekTo를 호출하면
                                // paused와 달리 재생이 시작돼버림 — 자동재생 방지 의도를 무시하므로 즉시 되돌림
                                if (!autoplay) this.player.pauseVideo()
                            }
                            // 음원 MusicPlayer.vue와 동일하게, 재생 여부와 무관하게 준비되는 즉시 진행바를 채움
                            // (재생 안 해도 복원된 위치/길이가 바로 보이도록). isPlaying watcher가 이후 폴링을 이어받음
                            if (this.player && this.player.getCurrentTime) {
                                this.currentTime = this.player.getCurrentTime()
                                this.duration = this.player.getDuration()
                            }
                            this.startTimeUpdate()
                        },
                        onError: this.handlePlayerError,
                        onStateChange: this.handlePlayerStateChange,
                    },
                })
            }

            if (typeof YT !== 'undefined' && YT.Player) {
                create()
            } else {
                if (!document.querySelector('script[src*="iframe_api"]')) {
                    const tag = document.createElement('script')
                    tag.src = 'https://www.youtube.com/iframe_api'
                    document.head.appendChild(tag)
                }
                const original = window.onYouTubeIframeAPIReady
                window.onYouTubeIframeAPIReady = () => {
                    if (original) original()
                    if (typeof YT !== 'undefined' && YT.Player) create()
                }
            }
        },
        handlePlayerError(event) {
            // 101 / 150: 외부 임베드 차단된 영상 → invidious로 fallback
            // 100: 영상 없음/비공개  /  2: 잘못된 파라미터  /  5: HTML5 플레이어 오류
            if (event.data === 101 || event.data === 150) {
                this.isBlocked = true
            } else {
                console.warn('YouTube player error code:', event.data)
            }
        },
        handlePlayerStateChange(event) {
            /* global YT */
            if (event.data === YT.PlayerState.ENDED) {
                this.playNext()
            } else if (event.data === YT.PlayerState.PLAYING) {
                this.isPlaying = true
            } else if (event.data === YT.PlayerState.PAUSED) {
                this.isPlaying = false
                this.savePosition()
            }
        },
    },
    mounted() {
        const volumeKey = this.getVolumeStorageKey()
        if (volumeKey) {
            const saved = localStorage.getItem(volumeKey)
            if (saved !== null) {
                this.volume = Number(saved)
                this.muted = this.volume === 0
            }
        }
        const positionKey = this.getPositionStorageKey()
        if (positionKey) {
            const saved = localStorage.getItem(positionKey)
            if (saved) {
                try { this.lastPosition = JSON.parse(saved) } catch (e) { /* ignore */ }
            }
        }
        // initializeQueue가 currentVideo를 동기적으로 복원하면 곧바로 watcher가 반응하는데,
        // 그 시점엔 justRestored가 아직 true라서 autoplay=false로 생성됨. 이후 실제 클릭은 모두
        // justRestored=false 상태에서 일어나므로 정상적으로 autoplay된다.
        this.justRestored = true
        this.initializeQueue()
        this.fetchPlaylists()
        this.$nextTick(() => { this.justRestored = false })
        // 재생 중일 때만 5초마다 위치 저장 (멈춰있을 때는 onStateChange의 PAUSED에서 처리)
        this.positionInterval = setInterval(() => {
            if (this.isPlaying) this.savePosition()
        }, 5000)
    },
    beforeDestroy() {
        if (this.positionInterval) clearInterval(this.positionInterval)
        this.stopTimeUpdate()
        this.savePosition()
        if (this.player && this.player.destroy) {
            try { this.player.destroy() } catch (e) { /* ignore */ }
            this.player = null
        }
    },
}
</script>

<style scoped>
.line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

/* 16:9 비율 유지하면서 뷰포트 높이를 넘지 않게 */
.video-frame {
    aspect-ratio: 16 / 9;
    width: 100%;
}

/* YT.Player가 div를 iframe으로 교체하면서 width/height attribute에 기본값(600x400)을 넣어버리는 걸 덮어씀 */
.video-frame iframe {
    width: 100%;
    height: 100%;
}
</style>
