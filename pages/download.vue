<template>
    <div class="flex-1 flex items-start justify-center px-4 py-10 pb-32">
        <div class="w-full max-w-md">
            <!-- 브랜드 헤더 -->
            <div class="text-center mb-8">
                <div class="mx-auto mb-4 w-20 h-20 rounded-3xl bg-gradient-to-br from-pink-500 via-pink-400 to-teal-400 flex items-center justify-center shadow-lg shadow-pink-500/20">
                    <i class="fas fa-moon text-3xl text-white"></i>
                </div>
                <h1 class="text-2xl font-bold">DIBE2 안드로이드 앱</h1>
                <p class="text-gray-400 text-sm mt-1">백그라운드 재생 · 잠금화면 컨트롤</p>
            </div>

            <!-- 카드 -->
            <div class="bg-gray-800/60 border border-white/10 rounded-2xl p-6">
                <!-- 로딩 -->
                <div v-if="loading" class="text-center py-8 text-gray-400">
                    <i class="fas fa-spinner fa-spin text-2xl"></i>
                    <p class="mt-3 text-sm">버전 정보를 불러오는 중...</p>
                </div>

                <!-- 아직 릴리스 없음 -->
                <div v-else-if="notReleased" class="text-center py-8 text-gray-400">
                    <i class="fas fa-hourglass-half text-2xl"></i>
                    <p class="mt-3 text-sm">아직 배포된 앱이 없습니다.</p>
                </div>

                <!-- 에러 -->
                <div v-else-if="error" class="text-center py-8 text-gray-400">
                    <i class="fas fa-triangle-exclamation text-2xl text-yellow-500"></i>
                    <p class="mt-3 text-sm">{{ error }}</p>
                    <button @click="fetchLatest" class="mt-4 text-pink-400 text-sm hover:underline">다시 시도</button>
                </div>

                <!-- 정상 -->
                <div v-else-if="latest">
                    <div class="flex items-center justify-between mb-4">
                        <div>
                            <div class="text-xs text-gray-400">최신 버전</div>
                            <div class="text-xl font-bold">v{{ latest.version }}</div>
                        </div>
                        <div class="text-right">
                            <div class="text-xs text-gray-400">크기</div>
                            <div class="text-sm font-medium">{{ sizeMb }} MB</div>
                        </div>
                    </div>

                    <div v-if="latest.notes"
                        class="bg-black/30 rounded-lg p-3 mb-5 max-h-40 overflow-y-auto custom-scrollbar">
                        <div class="text-xs text-gray-400 mb-1">변경사항</div>
                        <pre class="text-sm text-gray-200 whitespace-pre-wrap font-sans">{{ latest.notes }}</pre>
                    </div>

                    <button @click="download" :disabled="downloading"
                        class="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 transition disabled:opacity-60 flex items-center justify-center gap-2">
                        <i :class="downloading ? 'fas fa-spinner fa-spin' : 'fas fa-download'"></i>
                        {{ downloading ? '준비 중...' : 'APK 다운로드' }}
                    </button>
                </div>
            </div>

            <!-- 설치 안내 -->
            <div class="mt-5 text-xs text-gray-500 leading-relaxed space-y-1">
                <p class="font-semibold text-gray-400">설치 안내</p>
                <p>· 안드로이드 전용입니다.</p>
                <p>· 다운로드한 APK를 열면 "알 수 없는 출처 앱 설치" 허용을 물어봅니다. 허용해야 설치됩니다.</p>
                <p>· 설치 후 새 버전이 나오면 앱 안에서 자동으로 안내됩니다.</p>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    layout: 'main',
    head() {
        return { title: '앱 다운로드 | DIBE2' }
    },
    data() {
        return {
            loading: true,
            downloading: false,
            error: '',
            notReleased: false,
            latest: null,
        }
    },
    computed: {
        sizeMb() {
            if (!this.latest || !this.latest.size) return '—'
            return (this.latest.size / (1024 * 1024)).toFixed(1)
        },
    },
    methods: {
        async fetchLatest() {
            this.loading = true
            this.error = ''
            this.notReleased = false
            try {
                this.latest = await this.$axios.$get('/api/app/latest')
            } catch (err) {
                const status = err.response && err.response.status
                if (status === 404) this.notReleased = true
                else this.error = '버전 정보를 불러오지 못했습니다.'
            } finally {
                this.loading = false
            }
        },
        async download() {
            if (this.downloading) return
            this.downloading = true
            try {
                const { url } = await this.$axios.$get('/api/app/download')
                // 단기 서명 URL로 직접 이동 → 브라우저가 APK를 내려받음
                window.location.href = url
            } catch (err) {
                this.error = '다운로드에 실패했습니다. 잠시 후 다시 시도해 주세요.'
                this.downloading = false
                return
            }
            // 내비게이션이 시작되므로 잠시 후 버튼 해제
            setTimeout(() => { this.downloading = false }, 1500)
        },
    },
    mounted() {
        this.fetchLatest()
    },
}
</script>
