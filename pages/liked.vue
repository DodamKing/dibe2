<template>
	<main class="w-full max-w-[1600px] mx-auto px-4 sm:px-8 py-6 sm:py-8 flex-grow pb-28 sm:pb-36 flex flex-col gap-4">
		<div class="flex items-center gap-3 flex-wrap">
			<button
type="button" class="w-10 h-10 rounded-full bg-gray-800 text-gray-200 hover:bg-gray-700" aria-label="뒤로 가기"
				@click="$router.back()">
				<Icon name="arrow-left" />
			</button>
			<div class="w-12 h-12 rounded-lg bg-purple-600 flex items-center justify-center">
				<Icon name="heart" :size="22" filled class="text-white" />
			</div>
			<div>
				<h1 class="text-2xl sm:text-3xl font-bold">좋아요한 곡</h1>
				<p class="text-sm text-gray-400">{{ total === null ? '' : `${total}곡` }}</p>
			</div>
			<button
type="button" :disabled="!songs.length" class="ml-auto flex items-center gap-1.5 h-10 px-4 rounded-full bg-purple-500 hover:bg-purple-600 text-sm font-semibold disabled:opacity-50"
				@click="playAll">
				<Icon name="play" :size="12" filled />전체 재생
			</button>
		</div>

		<p v-if="loading && !songs.length" class="text-sm text-gray-400 py-6">불러오는 중이에요</p>
		<!-- 실패를 "없음"으로 보여주면 안 된다 — dev 재시작 중 요청이 실패해 "곡이 없다"로 보인 적이 있다 -->
		<div v-else-if="failed && !songs.length" class="py-6 flex items-center gap-3 text-sm text-gray-300">
			좋아요한 곡을 불러오지 못했어요.
			<button type="button" class="h-9 px-4 rounded-full border border-gray-600" @click="load(1)">다시 시도</button>
		</div>
		<p v-else-if="!songs.length" class="text-sm text-gray-400 py-6">
			아직 좋아요한 곡이 없어요. 차트나 재생 중인 곡의 하트를 눌러 보세요.
		</p>
		<div v-else class="flex flex-col">
			<!-- 좋아요를 취소해도 바로 빼지 않는다 — 실수로 눌렀을 때 그 자리에서 되돌릴 수 있게(다음 방문 때 빠짐) -->
			<SongRow
v-for="song in songs" :key="song._id" :song="song" :song-id="song._id"
				@play="playNow" @menu="menuSong = $event" />
		</div>
		<button
v-if="hasMore" type="button" :disabled="loading" class="self-center h-10 px-5 rounded-full border border-gray-600 text-sm text-gray-200 disabled:opacity-50"
			@click="load(page + 1)">
			{{ loading ? '불러오는 중…' : '더 보기' }}
		</button>

		<SongMenuSheet
:song="menuSong" :song-id="menuSong && menuSong._id" @close="menuSong = null"
			@add-to-playlist="addToMyPlaylist" />
	</main>
</template>

<script>
import SongRow from '~/components/SongRow.vue'
import SongMenuSheet from '~/components/SongMenuSheet.vue'

const PAGE_SIZE = 100

export default {
	components: { SongRow, SongMenuSheet },
	inject: ['layoutMethods'],
	layout: 'main',
	data() {
		return { songs: [], page: 1, hasMore: false, loading: false, failed: false, menuSong: null }
	},
	head() {
		return { title: '좋아요한 곡 | DIBE2' }
	},
	computed: {
		total() {
			return this.$store.state.likes.total
		},
	},
	mounted() {
		this.load(1)
	},
	methods: {
		async load(page) {
			this.loading = true
			this.failed = false
			try {
				const res = await this.$axios.$get('/api/songs/liked', { params: { page, limit: PAGE_SIZE } })
				this.songs = page === 1 ? res.songs : [...this.songs, ...res.songs]
				this.page = res.page
				this.hasMore = res.hasMore
				this.$store.commit('likes/SET_TOTAL', res.total)
				this.$store.dispatch('likes/seed', res.songs.map(s => ({ id: s._id, liked: true })))
			} catch (err) {
				this.failed = true
			} finally {
				this.loading = false
			}
		},
		// 줄 클릭 = 좋아요 목록을 그 곡부터. 하트를 취소한 곡은 빼고 튼다(누른 곡은 취소했어도 튼다)
		playNow(song) {
			const songs = this.songs.filter(s => s === song || this.$store.getters['likes/isLiked'](s._id))
			this.playFrom(songs, Math.max(0, songs.indexOf(song)))
		},
		playAll() {
			this.playFrom(this.songs.filter(s => this.$store.getters['likes/isLiked'](s._id)), 0)
		},
		playFrom(songs, index) {
			this.$store.dispatch('player/playList', { source: { type: 'liked', id: null, name: '좋아요한 곡' }, songs, idKey: '_id', index })
		},
		addToMyPlaylist(song) {
			this.menuSong = null
			this.layoutMethods.openAddModalFor([song])
		},
	},
}
</script>
