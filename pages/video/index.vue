<template>
    <div>
        <!-- 검색창: 풀폭 sticky (헤더 바로 아래, 헤더 height=64px에 맞춰 top-16).
             container 클래스는 쓰지 않음 — layouts/main.vue 전역 .container { overflow-x: hidden }이
             sticky의 scroll ancestor로 잡혀버려서 page scroll에 따라가지 못함 -->
        <div class="sticky top-16 z-20 bg-gray-900/95 backdrop-blur-sm">
            <div class="max-w-7xl mx-auto px-4 py-3">
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

        <!-- 선택된 영상 영역 (좁은 max-w-7xl 가운데) -->
        <div v-show="selectedVideo" class="max-w-7xl mx-auto px-4 pt-4 sm:pt-6 mb-6">
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
            <div v-if="selectedVideo" class="mt-3 px-1">
                <h2 class="text-base sm:text-lg font-semibold leading-snug">{{ selectedVideo.title }}</h2>
                <div class="flex items-center justify-between gap-3 mt-1">
                    <p class="text-sm text-gray-400 truncate">{{ selectedVideo.channelTitle }}</p>
                    <a :href="youtubeWatchUrl" target="_blank" rel="noopener"
                        class="text-xs text-gray-400 hover:text-white whitespace-nowrap flex items-center">
                        <i class="fab fa-youtube text-red-500 mr-1"></i>YouTube에서 보기
                    </a>
                </div>
            </div>
        </div>

        <!-- 결과/로딩/빈 상태 영역 (더 넓은 max-w-screen-2xl로 그리드 펼침) -->
        <div class="max-w-screen-2xl mx-auto px-4 pb-4 sm:pb-6" :class="{ 'pt-4 sm:pt-6': !selectedVideo }">

        <!-- 로딩 -->
        <div v-if="loading" class="text-center py-8 text-gray-300">
            <i class="fas fa-spinner fa-spin text-2xl"></i>
        </div>

        <!-- 결과 그리드 (모바일 1열 → sm 2열 → lg 3열 → xl 이상 4열) -->
        <div v-if="!loading && results.length > 0"
            class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            <button v-for="item in results" :key="item.id" @click="selectVideo(item)"
                class="text-left bg-white bg-opacity-5 hover:bg-opacity-10 rounded-lg overflow-hidden transition focus:outline-none focus:ring-2 focus:ring-white"
                :class="{ 'ring-2 ring-purple-400': selectedVideo && selectedVideo.id === item.id }">
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
        </div>

        <!-- 빈 상태 -->
        <div v-if="!loading && hasSearched && results.length === 0" class="text-center py-12 text-gray-400">
            검색 결과가 없습니다.
        </div>
        <div v-if="!hasSearched && results.length === 0" class="text-center py-12 text-gray-500 text-sm">
            검색어를 입력해주세요.
        </div>
        </div>
    </div>
</template>

<script>
// 차단 영상은 우회 시도를 안 함. invidious(yewtu.be 등)는 anti-bot + X-Frame-Options로 iframe 임베드 불가,
// 한국 라이선스 영상(TJ 카라오케 등)은 인스턴스 IP 제한으로 stream 추출도 실패하는 게 확인됨.
// 차단 감지 시 깔끔하게 "YouTube에서 보기" 안내로 종결.
export default {
    layout: 'video',
    head() {
        const base = 'DIBE2 비디오'
        return {
            title: this.selectedVideo ? `${this.selectedVideo.title} - ${base}` : base,
        }
    },
    data() {
        return {
            query: '',
            results: [],
            loading: false,
            hasSearched: false,
            selectedVideo: null,
            player: null,
            isBlocked: false,
        }
    },
    computed: {
        youtubeWatchUrl() {
            if (!this.selectedVideo) return ''
            return `https://www.youtube.com/watch?v=${this.selectedVideo.id}`
        },
    },
    methods: {
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
        async selectVideo(item) {
            const isFirstSelect = !this.selectedVideo
            this.selectedVideo = item
            this.isBlocked = false  // 새 영상은 YouTube 다시 시도

            if (isFirstSelect) {
                // 처음 영상 선택 — YT.Player 초기화 (div가 렌더된 다음)
                await this.$nextTick()
                this.initVideoPlayer(item.id)
            } else if (this.player && this.player.loadVideoById) {
                this.player.loadVideoById(item.id)
            }

            window.scrollTo({ top: 0, behavior: 'smooth' })
        },
        initVideoPlayer(videoId) {
            const create = () => {
                this.player = new YT.Player('video-page-player', {
                    host: 'https://www.youtube-nocookie.com',
                    videoId,
                    playerVars: {
                        autoplay: 1,
                        rel: 0,
                        playsinline: 1,
                    },
                    events: {
                        onError: this.handlePlayerError,
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
    },
    beforeDestroy() {
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

/* 16:9 비율 유지하면서 뷰포트 높이를 넘지 않게.
   width를 max-height 기준으로 cap하여 화면이 좁아져도 비율 유지.
   14rem = 헤더(64px) + 검색창(72px) + 영상 정보(~70px) + page padding(~24px) ≈ 230px */
.video-frame {
    aspect-ratio: 16 / 9;
    width: 100%;
    max-height: calc(100vh - 14rem);
    margin-left: auto;
    margin-right: auto;
}

@media (min-width: 640px) {
    .video-frame {
        width: min(100%, calc((100vh - 14rem) * 16 / 9));
    }
}

/* YT.Player가 div를 iframe으로 교체하면서 width/height attribute에 기본값(600x400)을 넣어버리는 걸 덮어씀 */
.video-frame iframe {
    width: 100%;
    height: 100%;
}
</style>
