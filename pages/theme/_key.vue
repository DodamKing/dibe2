<template>
	<main class="w-full max-w-[1600px] mx-auto px-4 sm:px-8 py-6 sm:py-8 flex-grow pb-28 sm:pb-36 flex flex-col gap-4">
		<div>
			<BackButton fallback="/theme" />
		</div>

		<section class="flex items-end gap-4 sm:gap-6">
			<CoverImg :src="cover" video class="w-28 h-28 sm:w-44 sm:h-44 rounded-xl shadow-lg" />
			<div class="min-w-0">
				<p class="hidden sm:block text-[13px] text-gray-400 mb-1">테마</p>
				<h1 class="text-2xl sm:text-4xl font-bold truncate">{{ name || listName }}</h1>
				<p class="mt-1.5 text-[13px] text-gray-400 flex items-center gap-1.5">
					<Icon name="youtube" :size="14" class="text-red-400" />
					{{ songs.length || 50 }}곡 · 유튜브<template v-if="updatedAt"> · {{ fmt(updatedAt) }} 갱신</template>
				</p>
			</div>
		</section>

		<div class="flex gap-2">
			<button type="button" :disabled="!songs.length" class="flex items-center justify-center gap-1.5 h-11 px-5 rounded-full bg-purple-500 hover:bg-purple-600 text-sm font-semibold disabled:opacity-50"
				@click="playFrom(0)">
				<Icon name="play" :size="14" filled />전체 재생
			</button>
			<button type="button" :disabled="!songs.length" class="flex items-center justify-center gap-1.5 h-11 px-5 rounded-full border border-gray-600 text-sm text-gray-200 hover:bg-white hover:bg-opacity-5 disabled:opacity-50"
				@click="playFrom(null, true)">
				<Icon name="shuffle" :size="16" />셔플
			</button>
		</div>

		<!-- 실패·응답 없음은 "불러오는 중"에 멈춰 두지 않고 다시 시도하게 한다(브라우저·콜드 스타트로 멈춘 적 있음) -->
		<div v-if="failed" class="py-6 flex items-center gap-3 text-sm text-gray-300">
			이 테마를 불러오지 못했어요.
			<button type="button" class="h-9 px-4 rounded-full border border-gray-600 hover:bg-white hover:bg-opacity-5" @click="load">다시 시도</button>
		</div>
		<p v-else-if="!songs.length" class="text-sm text-gray-400 py-6">곡을 불러오는 중이에요</p>
		<div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-x-6">
			<div v-for="(song, i) in songs" :key="song.videoId"
				class="song-row group flex items-center gap-3 px-2 sm:px-3 py-2 rounded-lg hover:bg-white hover:bg-opacity-5 transition-colors cursor-pointer"
				@click="playFrom(i)">
				<span class="w-6 sm:w-7 text-right text-sm font-semibold text-gray-400 shrink-0 tabular-nums">{{ i + 1 }}</span>
				<CoverImg :src="song.thumbnail" video lazy class="w-11 h-11 rounded-md" />
				<div class="min-w-0 flex-1">
					<p class="text-sm sm:text-[15px] font-medium leading-tight truncate" :class="{ 'text-purple-300': isCurrent(song) }">{{ song.title }}</p>
					<p class="text-xs sm:text-[13px] text-gray-400 truncate leading-tight mt-0.5">{{ song.artist }}<template v-if="song.duration"> · {{ dur(song.duration) }}</template></p>
				</div>
				<button type="button" class="menu-btn flex items-center justify-center w-11 h-11 sm:w-10 sm:h-10 shrink-0 rounded-full text-gray-400 hover:text-white"
					aria-label="곡 메뉴" @click.stop="menuSong = song">
					<Icon name="ellipsis-vertical" />
				</button>
			</div>
		</div>

		<SongMenuSheet :song="menuSong" kind="video" @close="menuSong = null" />
	</main>
</template>

<script>
import dayjs from 'dayjs'
import SongMenuSheet from '~/components/SongMenuSheet.vue'

export default {
	components: { SongMenuSheet },
	layout: 'main',
	data() {
		return { name: '', songs: [], seed: null, updatedAt: null, failed: false, menuSong: null }
	},
	head() {
		return { title: `${this.name || '테마'} | DIBE2` }
	},
	computed: {
		key() {
			return this.$route.params.key
		},
		// 목록 카드와 같은 그림(1위 곡). 목록을 아직 안 받았으면 첫 곡
		listName() {
			const t = this.$store.state.themes.list.find(x => x.key === this.key)
			return t ? t.name : ''
		},
		cover() {
			const t = this.$store.state.themes.list.find(x => x.key === this.key)
			return (t && t.cover) || (this.songs[0] && this.songs[0].thumbnail) || ''
		},
	},
	mounted() {
		this.$store.dispatch('themes/fetchList')
		this.load()
	},
	methods: {
		async load() {
			this.failed = false
			try {
				// 20초 안에 안 오면 실패로 — 그대로 두면 "불러오는 중"에서 영영 멈춘다
				const res = await this.$axios.$get(`/api/themes/${encodeURIComponent(this.key)}`, { timeout: 20000 })
				this.name = res.theme.name
				this.songs = res.songs || []
				this.seed = res.seed
				this.updatedAt = res.updatedAt
			} catch (err) {
				this.failed = true
			}
		},
		// 줄 클릭 = 이 테마 50곡을 그 곡부터. 곡들은 유튜브 영상이라 kind 'video'
		playFrom(index, shuffle = false) {
			this.$store.dispatch('player/playList', {
				source: { type: 'theme', id: `${this.key}:${this.seed}`, name: this.name },
				songs: this.songs,
				kind: 'video',
				index,
				shuffle,
			})
		},
		isCurrent(song) {
			const cur = this.$store.state.player.currentTrack
			return !!(cur && cur.kind === 'video' && cur.videoId === song.videoId)
		},
		fmt(d) {
			return dayjs(d).format('M월 D일')
		},
		dur(sec) {
			const s = Math.round(Number(sec) || 0)
			return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
		},
	},
}
</script>

<style scoped>
@media (hover: hover) and (min-width: 640px) {
	.menu-btn { opacity: 0; }
	.song-row:hover .menu-btn,
	.menu-btn:focus-visible { opacity: 1; }
}
</style>
