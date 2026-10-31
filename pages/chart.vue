<template>
	<main class="w-full max-w-[1600px] mx-auto px-4 sm:px-8 py-6 sm:py-8 flex-grow pb-28 sm:pb-36 flex flex-col gap-4">
		<div class="flex items-center gap-3 flex-wrap">
			<button
type="button" class="w-10 h-10 rounded-full bg-gray-800 text-gray-200 hover:bg-gray-700" aria-label="뒤로 가기"
				@click="$router.back()">
				<i class="fas fa-arrow-left"></i>
			</button>
			<h1 class="text-2xl sm:text-3xl font-bold">{{ isPop ? '해외 Top 100' : '오늘의 Top 100' }}</h1>
			<div role="group" aria-label="차트 종류" class="flex bg-gray-800 rounded-full p-1">
				<button type="button" :class="tabClass(!isPop)" :aria-pressed="!isPop ? 'true' : 'false'" @click="setType(false)">국내</button>
				<button type="button" :class="tabClass(isPop)" :aria-pressed="isPop ? 'true' : 'false'" @click="setType(true)">해외</button>
			</div>
			<span v-if="updated" class="text-[13px] text-gray-400">{{ updated }} 업데이트</span>
		</div>

		<!-- 선택 도구줄 — 기존 "전체 선택 → 추가" 기능 -->
		<div class="sticky top-0 z-10 flex items-center gap-2 flex-wrap px-3 py-2 rounded-xl bg-surface-1 bg-opacity-95 border border-white border-opacity-10">
			<label class="flex items-center gap-2 text-sm text-gray-200 min-h-[40px] cursor-pointer">
				<input type="checkbox" class="form-checkbox h-4 w-4 text-purple-600" :checked="allSelected" @change="toggleAll" />
				전체 선택
			</label>
			<span v-if="selectedCount" class="text-sm text-gray-400 ml-1">{{ selectedCount }}곡 선택됨</span>
			<div class="ml-auto flex gap-2">
				<button
type="button" :disabled="!chart.length" class="flex items-center gap-1.5 h-10 px-4 rounded-full bg-purple-500 hover:bg-purple-600 text-sm font-semibold disabled:opacity-50"
					@click="playAll">
					<i class="fas fa-play text-xs"></i>전체 재생
				</button>
				<button
type="button" :disabled="!selectedCount" class="h-10 px-4 rounded-full border border-gray-600 text-sm text-gray-200 hover:bg-white hover:bg-opacity-5 disabled:opacity-50"
					@click="layoutMethods.showAddToPlaylistModal()">
					선택 곡 담기
				</button>
			</div>
		</div>

		<p v-if="!chart.length" class="text-sm text-gray-400 py-6">차트를 불러오는 중이에요</p>
		<div v-else class="flex flex-col">
			<SongRow
v-for="(song, i) in chart" :key="`${i}-${song.title}-${song.artist}`"
				:song="song" :song-id="song.songId || null" :rank="i + 1" show-album selectable
				:selected="layoutMethods.isSongSelected(song)"
				@toggle-select="layoutMethods.toggleSongSelection" @play="playNow" @menu="menuSong = $event" />
		</div>

		<SongMenuSheet
:song="menuSong" :song-id="menuSong && menuSong.songId" @close="menuSong = null"
			@add-to-playlist="addToMyPlaylist" />
	</main>
</template>

<script>
import SongRow from '~/components/SongRow.vue'
import SongMenuSheet from '~/components/SongMenuSheet.vue'

export default {
	components: { SongRow, SongMenuSheet },
	inject: ['layoutMethods', 'layoutData'],
	layout: 'main',
	data() {
		return { menuSong: null }
	},
	head() {
		return { title: `${this.isPop ? '해외 Top 100' : '오늘의 Top 100'} | DIBE2` }
	},
	computed: {
		isPop() {
			return this.$route.query.type === 'pop'
		},
		chart() {
			return this.isPop ? this.layoutData.popChart() : this.layoutData.popularChart()
		},
		updated() {
			return this.isPop ? this.layoutData.lastPopUpdated() : this.layoutData.lastChartUpdated()
		},
		selectedCount() {
			return this.layoutData.selectedSongs().length
		},
		allSelected() {
			return this.chart.length > 0 && this.chart.every(s => this.layoutMethods.isSongSelected(s))
		},
	},
	// 국내/해외를 바꾸면 선택을 비운다 — 안 그러면 안 보이는 곡이 담긴다
	watch: {
		isPop() {
			this.layoutMethods.setSelectedSongs([])
		},
	},
	beforeDestroy() {
		this.layoutMethods.setSelectedSongs([])
	},
	methods: {
		tabClass(active) {
			return ['h-9 px-4 rounded-full text-sm font-semibold', active ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-200']
		},
		setType(pop) {
			this.$router.replace({ query: pop ? { type: 'pop' } : {} })
		},
		toggleAll() {
			this.layoutMethods.setSelectedSongs(this.allSelected ? [] : this.chart)
		},
		// 줄 클릭 = 차트 전체를 그 곡부터(스포티파이·애플뮤직 방식). "다음에 재생"에 넣은 곡은 지켜진다
		playNow(song) {
			this.playFrom(Math.max(0, this.chart.indexOf(song)))
		},
		playAll() {
			this.playFrom(0)
		},
		playFrom(index) {
			this.$store.dispatch('player/playList', {
				source: { type: 'chart', id: this.isPop ? 'pop' : 'kr', name: this.isPop ? '해외 Top 100' : 'Top 100 국내' },
				songs: this.chart,
				idKey: 'songId',
				index,
			})
		},
		addToMyPlaylist(song) {
			this.menuSong = null
			this.layoutMethods.openAddModalFor([song])
		},
	},
}
</script>
