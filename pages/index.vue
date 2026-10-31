<template>
	<main class="w-full max-w-[1600px] mx-auto px-4 sm:px-8 py-6 sm:py-8 flex-grow pb-28 sm:pb-36 flex flex-col gap-10 sm:gap-12">

		<!-- 내 플레이리스트 (첫 칸 = 좋아요한 곡, 고정) -->
		<section class="flex flex-col gap-3">
			<div class="flex items-center justify-between">
				<h2 class="text-xl sm:text-2xl font-bold">내 플레이리스트</h2>
				<button
type="button" class="flex items-center gap-1.5 h-9 px-4 rounded-full border border-gray-600 text-sm text-gray-200 hover:bg-white hover:bg-opacity-5"
					@click="showCreatePlaylistModal">
					<i class="fas fa-plus text-xs"></i>새로 만들기
				</button>
			</div>
			<!-- 커버를 크게 — 화면의 색은 대부분 앨범 아트에서 나온다(스포티파이식 정사각 카드).
				 삭제는 홈 카드에 두지 않고 플레이리스트 상세의 메뉴에서 한다 -->
			<div class="playlist-grid -mx-2 sm:mx-0">
				<nuxt-link to="/liked" class="playlist-card group">
					<div class="aspect-square rounded-lg bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center shadow-lg">
						<i class="fas fa-heart text-white text-3xl sm:text-4xl"></i>
					</div>
					<p class="mt-2 font-semibold truncate">좋아요한 곡</p>
					<p class="text-sm text-gray-400">{{ likedTotal === null ? '' : `${likedTotal}곡` }}</p>
				</nuxt-link>

				<nuxt-link v-for="playlist in playlists" :key="playlist._id" :to="`/playlist/${playlist._id}`" class="playlist-card group">
					<!-- 4곡 이상이면 2×2 모자이크, 그보다 적으면 첫 곡 커버 한 장 -->
					<div class="aspect-square rounded-lg overflow-hidden bg-surface-2 shadow-lg">
						<div v-if="playlist.songs.length >= 4" class="grid grid-cols-2 grid-rows-2 w-full h-full">
							<img v-for="(song, i) in playlist.songs.slice(0, 4)" :key="i" :src="bigCover(song)" alt="" class="w-full h-full object-cover" loading="lazy" />
						</div>
						<img v-else-if="playlist.songs.length" :src="bigCover(playlist.songs[0])" alt="" class="w-full h-full object-cover" loading="lazy" />
						<div v-else class="w-full h-full flex items-center justify-center">
							<i class="fas fa-music text-gray-500 text-2xl"></i>
						</div>
					</div>
					<p class="mt-2 font-semibold truncate">{{ playlist.name }}</p>
					<p class="text-sm text-gray-400">{{ playlist.songs.length }}곡</p>
				</nuxt-link>
			</div>
		</section>

		<!-- Top 100 (국내/해외) -->
		<section class="flex flex-col gap-3 bg-surface-1 rounded-2xl p-3 sm:p-6 -mx-1 sm:mx-0 border border-white border-opacity-5">
			<div class="flex items-center gap-3 flex-wrap">
				<h2 class="text-xl sm:text-2xl font-bold">{{ isPop ? '해외 Top 100' : '오늘의 Top 100' }}</h2>
				<div role="group" aria-label="차트 종류" class="flex bg-gray-800 rounded-full p-1">
					<button type="button" :class="tabClass(!isPop)" :aria-pressed="!isPop ? 'true' : 'false'" @click="isPop = false">국내</button>
					<button type="button" :class="tabClass(isPop)" :aria-pressed="isPop ? 'true' : 'false'" @click="isPop = true">해외</button>
				</div>
				<span v-if="updated" class="text-[13px] text-gray-400">{{ updated }} 업데이트</span>
				<div class="flex gap-2 w-full sm:w-auto sm:ml-auto">
					<button
type="button" :disabled="!chart.length" class="flex items-center gap-1.5 h-10 px-4 rounded-full bg-purple-500 hover:bg-purple-600 text-sm font-semibold disabled:opacity-50"
						@click="playAll">
						<i class="fas fa-play text-xs"></i>전체 재생
					</button>
					<nuxt-link
:to="isPop ? '/chart?type=pop' : '/chart'"
						class="flex items-center h-10 px-4 rounded-full border border-gray-600 text-sm text-gray-200 hover:bg-white hover:bg-opacity-5">
						전체 보기
					</nuxt-link>
				</div>
			</div>

			<p v-if="!chart.length" class="text-sm text-gray-400 py-6">{{ isPop ? '해외 차트를 불러오는 중이에요' : '차트를 불러오는 중이에요' }}</p>
			<div v-else class="grid grid-cols-1 lg:grid-cols-2 gap-x-6">
				<SongRow
v-for="(song, i) in chart.slice(0, 10)" :key="`${i}-${song.title}-${song.artist}`"
					:song="song" :song-id="song.songId || null" :rank="i + 1"
					@play="playNow" @menu="menuSong = $event" />
			</div>
		</section>

		<SongMenuSheet
:song="menuSong" :song-id="menuSong && menuSong.songId" @close="menuSong = null"
			@added="toast('재생목록에 추가했어요.')" @add-to-playlist="addToMyPlaylist" />
	</main>
</template>

<script>
import { mapState } from 'vuex'
import SongRow from '~/components/SongRow.vue'
import SongMenuSheet from '~/components/SongMenuSheet.vue'

export default {
	components: { SongRow, SongMenuSheet },
	inject: ['layoutMethods', 'layoutData'],
	layout: 'main',
	data() {
		return {
			isPop: false,
			menuSong: null,
		}
	},
	computed: {
		...mapState('likes', { likedTotal: 'total' }),
		chart() {
			return this.isPop ? this.layoutData.popChart() : this.layoutData.popularChart()
		},
		updated() {
			return this.isPop ? this.layoutData.lastPopUpdated() : this.layoutData.lastChartUpdated()
		},
		playlists() {
			return this.layoutData.playlists()
		},
	},
	methods: {
		tabClass(active) {
			return ['h-9 px-4 rounded-full text-sm font-semibold', active ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-200']
		},
		bigCover(song) {
			return (song.coverUrl || '').replace('/50/', '/200/')
		},
		playNow(song) {
			this.$store.dispatch('player/playNow', song)
		},
		playAll() {
			this.$store.dispatch('player/playEntirePlaylist', { songs: this.chart })
		},
		showCreatePlaylistModal() {
			this.layoutMethods.showCreatePlaylistModal()
		},
		addToMyPlaylist(song) {
			this.menuSong = null
			this.layoutMethods.openAddModalFor([song])
		},
		toast(message) {
			this.$store.commit('player/SET_NOTICE', message)
		},
	},
}
</script>

<style scoped>
/* 모바일: 가로로 넘기는 한 줄 / 데스크탑: 칸이 남으면 늘리지 않고 왼쪽부터 채운다(1~2개여도 휑하게 늘어나지 않게) */
.playlist-grid {
	display: flex;
	gap: 4px;
	overflow-x: auto;
	scrollbar-width: none;
}
.playlist-grid::-webkit-scrollbar { display: none; }
.playlist-card {
	flex: 0 0 140px;
	padding: 8px;
	border-radius: 10px;
	transition: background-color 0.15s;
}
.playlist-card:hover { background-color: rgba(255, 255, 255, 0.06); }
@media (min-width: 640px) {
	.playlist-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
		gap: 8px;
		overflow: visible;
	}
	.playlist-card { flex: none; padding: 10px; }
}
</style>
