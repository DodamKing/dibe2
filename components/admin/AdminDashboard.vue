<template>
    <!--
        대시보드 = "손볼 게 있나" 한눈에 (2026-11-08 재구성). 데이터는 GET /api/admin/dashboard 한 번.
        예전 방문자 통계(페이지뷰)는 기록이 2026-03-29에 끊겨 있었고, 로그인해야 쓰는 서비스라
        "재생한 사용자"(활동 사용자)로 대체했다. 빨강 = 실패·손볼 것, 노랑 = 오래됨
    -->
    <div>
        <!-- 모바일은 위 탭이 제목 역할이라 제목을 숨기고, 새로고침도 브라우저의 당겨서 새로고침에 맡긴다 -->
        <div class="hidden md:flex items-center justify-between mb-4">
            <h2 class="text-2xl font-semibold text-gray-900">대시보드</h2>
            <button type="button" :disabled="loading"
                class="h-10 px-4 rounded-md border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                @click="load">새로고침</button>
        </div>

        <p v-if="error" class="text-sm text-red-600">불러오지 못했어요: {{ error }}</p>
        <p v-else-if="!data" class="text-sm text-gray-500">불러오는 중이에요</p>

        <div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <!-- 1. 크론 -->
            <section class="card lg:col-span-2">
                <h3 class="card-title">크론 <span class="card-sub">최근 7일</span></h3>
                <div class="divide-y divide-gray-100">
                    <div v-for="c in data.cron" :key="c.job" class="py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                        <span class="w-28 font-medium text-gray-900 truncate">{{ c.label }}</span>
                        <span :class="['badge', statusClass(c.last && c.last.status)]">{{ statusLabel(c.last && c.last.status) }}</span>
                        <!-- 폰에선 시각을 항상 둘째 줄로(폭에 따라 줄마다 꺾이는 자리가 달라 들쭉날쭉했다) -->
                        <span class="order-last basis-full sm:order-none sm:basis-auto text-xs sm:text-sm text-gray-500">{{ c.last ? `${ago(c.last.startedAt)} · ${kst(c.last.startedAt)}` : '7일간 실행 없음' }}</span>
                        <!-- 빨강은 마지막 실행이 실패일 때만. 그 뒤 성공한 실패는 회색(해결됨) -->
                        <span class="ml-auto tabular-nums" :class="isFailing(c) ? 'text-red-600 font-medium' : 'text-gray-400'">
                            {{ c.runs7d }}회<template v-if="c.fails7d"> · 실패 {{ c.fails7d }}</template>
                        </span>
                        <!-- min-w-0: 긴 에러 문구 때문에 목록이 카드 밖으로 밀리지 않게(360px에서 3px 넘침) -->
                        <ul v-if="c.failures.length" class="order-last basis-full min-w-0 w-full space-y-0.5">
                            <li v-for="(f, i) in c.failures" :key="i" class="flex items-baseline gap-2 text-xs min-w-0"
                                :class="f.resolved ? 'text-gray-400' : 'text-red-600'">
                                <span class="shrink-0 tabular-nums">{{ kst(f.startedAt) }}</span>
                                <span class="shrink-0">{{ statusLabel(f.status) }}</span>
                                <span class="min-w-0 break-words sm:truncate">{{ f.error || '' }}</span>
                                <span class="ml-auto shrink-0 font-medium">{{ f.resolved ? '이후 정상' : '아직 실패 중' }}</span>
                            </li>
                        </ul>
                    </div>
                </div>
                <p class="mt-2 text-xs text-gray-400">자세한 기록은 <code>node scripts/cron-health.js</code></p>
            </section>

            <!-- 2. 음원 -->
            <section class="card">
                <h3 class="card-title">음원</h3>
                <dl class="stats">
                    <div><dt>전체 곡</dt><dd>{{ fmt(data.music.total) }}</dd></div>
                    <div><dt>누적 재생</dt><dd>{{ fmt(data.music.totalPlays) }}</dd></div>
                    <div :class="{ warn: data.music.gated }">
                        <dt>연령 게이트 <span class="block text-[11px] font-normal">손으로 채울 곡</span></dt><dd>{{ fmt(data.music.gated) }}</dd>
                    </div>
                </dl>
                <h4 class="sub-title">크론이 아직 채울 곡</h4>
                <dl class="stats">
                    <div><dt>유튜브 주소</dt><dd>{{ fmt(data.music.backlog.youtube) }}</dd></div>
                    <div><dt>가사</dt><dd>{{ fmt(data.music.backlog.lyrics) }}</dd></div>
                    <div><dt>장르</dt><dd>{{ fmt(data.music.backlog.genre) }}</dd></div>
                </dl>
                <p class="mt-3 text-sm text-gray-600">
                    최근 차트 상위 {{ data.music.chartTop.size }}곡 — 유튜브
                    <b :class="data.music.chartTop.youtube < data.music.chartTop.size ? 'text-red-600' : ''">{{ data.music.chartTop.youtube }}</b>,
                    가사 <b>{{ data.music.chartTop.lyrics }}</b>
                </p>
                <template v-if="data.music.gated">
                    <h4 class="sub-title">연령 게이트 — 유튜브 주소를 손으로 넣을 곡</h4>
                    <ul class="text-sm divide-y divide-gray-100">
                        <li v-for="(s, i) in data.music.gatedSongs" :key="i" class="py-1.5 truncate text-gray-900">
                            {{ s.title }} <span class="text-gray-500">· {{ s.artist }}</span>
                        </li>
                    </ul>
                    <button type="button" class="mt-2 h-10 px-4 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                        @click="$router.push({ query: { tab: 'music', type: 'ytgated' } })">
                        채우러 가기<template v-if="data.music.gated > data.music.gatedSongs.length"> ({{ data.music.gated }}곡)</template>
                    </button>
                </template>
            </section>

            <!-- 3. 테마 -->
            <section class="card">
                <h3 class="card-title">테마 <span class="card-sub">수집일 · 후보 곡 core / 탐색</span></h3>
                <div class="divide-y divide-gray-100">
                    <div v-for="t in data.themes" :key="t.key" class="py-2 flex items-center gap-3 text-sm whitespace-nowrap">
                        <span class="w-20 font-medium text-gray-900 truncate">{{ t.name }}</span>
                        <span :class="t.stale ? 'text-amber-600 font-medium' : 'text-gray-500'">
                            {{ t.lastRefreshedAt ? `${day(t.lastRefreshedAt)} · ${ago(t.lastRefreshedAt)}` : '수집 기록 없음' }}
                        </span>
                        <span class="ml-auto tabular-nums text-gray-500">{{ t.core }} / {{ t.explore }}</span>
                    </div>
                </div>
                <p class="mt-2 text-xs text-gray-400">
                    수집은 로컬 <code>node scripts/refresh-themes.js</code><template v-if="data.themes.some(t => t.stale)"> · <span class="text-amber-600">노란색 = 90일 넘게 수집 안 함</span></template>
                </p>
            </section>

            <!-- 4. 사용자 -->
            <section class="card">
                <h3 class="card-title">사용자</h3>
                <dl class="stats">
                    <div><dt>전체 <span class="block text-[11px] font-normal">&nbsp;</span></dt><dd>{{ fmt(data.users.total) }}</dd></div>
                    <div><dt>신규 <span class="block text-[11px] font-normal">7일</span></dt><dd>{{ fmt(data.users.new7d) }}</dd></div>
                    <div><dt>활동 <span class="block text-[11px] font-normal">7일 / 30일</span></dt><dd>{{ data.users.active7d }} / {{ data.users.active30d }}</dd></div>
                </dl>
                <p class="mt-1 text-xs text-gray-400">활동 = 그 기간에 재생한 사용자 (웹·앱 합산. 테마·영상은 웹만 2026-11-08부터)</p>

                <h4 class="sub-title">최근 활동 <span class="font-normal text-gray-400">마지막 재생</span></h4>
                <p v-if="!data.users.recentActive.length" class="text-sm text-gray-400">재생 기록 없음</p>
                <ul v-else class="text-sm divide-y divide-gray-100">
                    <li v-for="u in data.users.recentActive" :key="u.id" class="py-1.5 flex items-center gap-2 min-w-0">
                        <span class="truncate text-gray-900">{{ userName(u) }}</span>
                        <span v-if="u.provider" class="shrink-0 text-xs text-gray-400">{{ providerLabel(u.provider) }}</span>
                        <span v-if="u.plays7d" class="shrink-0 text-xs text-gray-400">· 7일 {{ u.plays7d }}회</span>
                        <span class="ml-auto shrink-0 text-gray-500 tabular-nums">{{ ago(u.lastPlayedAt) }}</span>
                    </li>
                </ul>

                <h4 class="sub-title">최근 가입</h4>
                <ul class="text-sm divide-y divide-gray-100">
                    <li v-for="u in data.users.recent" :key="u.id" class="py-1.5 flex items-center gap-2 min-w-0">
                        <span class="truncate text-gray-900">{{ userName(u) }}</span>
                        <span v-if="u.provider" class="shrink-0 text-xs text-gray-400">{{ providerLabel(u.provider) }}</span>
                        <span class="ml-auto shrink-0 text-gray-500 tabular-nums">{{ day(u.createdAt) }}</span>
                    </li>
                </ul>

                <h4 class="sub-title">곧 만료 <span class="font-normal text-gray-400">7일 안</span></h4>
                <p v-if="!data.users.expiring.length" class="text-sm text-gray-400">없음</p>
                <ul v-else class="text-sm divide-y divide-gray-100">
                    <li v-for="u in data.users.expiring" :key="u.id" class="py-1.5 flex items-center gap-2 min-w-0">
                        <span class="truncate text-gray-900">{{ userName(u) }}</span>
                        <span class="ml-auto shrink-0 text-red-600 tabular-nums">{{ day(u.expiryDate) }} 만료</span>
                    </li>
                </ul>
                <p v-if="data.users.expiring.length" class="mt-1 text-xs text-gray-500">기간 연장은 사용자 관리</p>
            </section>

            <!-- 5. 이용 -->
            <section class="card">
                <h3 class="card-title">이용 <span class="card-sub">최근 7일</span></h3>
                <dl class="stats">
                    <div><dt>재생</dt><dd>{{ fmt(data.usage.plays7d) }}</dd></div>
                    <div><dt>웹</dt><dd>{{ fmt(data.usage.platform.web) }}</dd></div>
                    <div><dt>앱</dt><dd>{{ fmt(data.usage.platform.app) }}</dd></div>
                </dl>
                <p v-if="data.usage.platform.unknown" class="mt-1 text-xs text-gray-400">
                    웹·앱 구분은 2026-11-08부터 — 그 전 {{ fmt(data.usage.platform.unknown) }}회는 구분 없음
                </p>
                <h4 class="sub-title">많이 들은 곡</h4>
                <p v-if="!data.usage.top.length" class="text-sm text-gray-400">재생 기록 없음</p>
                <ol v-else class="text-sm divide-y divide-gray-100">
                    <li v-for="(s, i) in data.usage.top" :key="i" class="py-1.5 flex items-center gap-2 min-w-0">
                        <span class="w-4 shrink-0 text-gray-400 tabular-nums">{{ i + 1 }}</span>
                        <span class="truncate text-gray-900">{{ s.title }} <span class="text-gray-500">· {{ s.artist }}</span></span>
                        <span v-if="s.kind !== 'song'" class="shrink-0 px-1.5 rounded bg-red-50 text-[11px] text-red-600">{{ s.kind === 'theme' ? '테마' : '영상' }}</span>
                        <span class="ml-auto shrink-0 text-gray-500 tabular-nums">{{ s.plays }}회</span>
                    </li>
                </ol>
                <p class="mt-1 text-xs text-gray-400">테마·영상은 웹 재생만 2026-11-08부터 집계</p>
            </section>
        </div>
    </div>
</template>

<script>
import dayjs from 'dayjs'

const STATUS = {
    ok: ['정상', 'bg-green-100 text-green-800'],
    error: ['에러', 'bg-red-100 text-red-700'],
    timeout: ['타임아웃', 'bg-red-100 text-red-700'],
    wiped: ['전멸', 'bg-red-100 text-red-700'],
    running: ['실행 중', 'bg-blue-100 text-blue-700'],
}

export default {
    data() {
        return { data: null, loading: false, error: null }
    },
    mounted() {
        this.load()
    },
    methods: {
        async load() {
            this.loading = true
            this.error = null
            try {
                this.data = await this.$axios.$get('/api/admin/dashboard', { timeout: 20000 })
            } catch (err) {
                this.error = err.message
            } finally {
                this.loading = false
            }
        },
        // 카카오 계정은 이메일·이름이 비어 있을 수 있다(관리자 계정이 그렇다) → "카카오 사용자 …fa0d" 처럼
        userName(u) {
            if (u.deleted) return '(삭제된 사용자)'
            const name = u.username || u.email
            const fallback = `사용자 …${String(u.id).slice(-4)}` // 가입 방식은 옆에 따로 표시
            return `${name || fallback}${u.isAdmin ? ' (관리자)' : ''}`
        },
        isFailing(c) {
            return !!(c.last && ['error', 'timeout', 'wiped'].includes(c.last.status))
        },
        statusLabel(s) {
            return s ? (STATUS[s] || [s])[0] : '기록 없음'
        },
        statusClass(s) {
            if (!s) return 'bg-gray-100 text-gray-500'
            return STATUS[s] ? STATUS[s][1] : 'bg-gray-100 text-gray-700'
        },
        providerLabel(p) {
            return { google: '구글', kakao: '카카오' }[p] || p
        },
        fmt(n) {
            return Number(n || 0).toLocaleString('ko-KR')
        },
        day(d) {
            return dayjs(d).format('YY.M.D')
        },
        kst(d) {
            return dayjs(d).format('M/D HH:mm')
        },
        ago(d) {
            const min = Math.max(0, (Date.now() - new Date(d)) / 60000)
            if (min < 60) return `${Math.round(min)}분 전`
            if (min < 60 * 24) return `${Math.round(min / 60)}시간 전`
            return `${Math.round(min / 60 / 24)}일 전`
        },
    },
}
</script>

<style scoped>
.card { @apply bg-white shadow rounded-lg p-4 sm:p-6 min-w-0; }
.card-title { @apply text-lg font-semibold text-gray-900 mb-3; }
.card-sub { @apply ml-1 text-xs font-normal text-gray-400; }
.sub-title { @apply mt-4 mb-1 text-sm font-semibold text-gray-700; }
.stats { @apply grid grid-cols-3 gap-2; }
.stats > div { @apply rounded-md bg-gray-50 px-3 py-2; }
.stats > div.warn { @apply bg-red-50; }
.stats dt { @apply text-xs font-medium text-gray-500; }
.stats dd { @apply mt-0.5 text-lg font-semibold text-gray-900 tabular-nums; }
.stats > div.warn dd { @apply text-red-600; }
.badge { @apply shrink-0 px-2 py-0.5 rounded text-xs font-medium; }
</style>
