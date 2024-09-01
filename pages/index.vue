<template>
	<div class="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white flex flex-col">
		<AppHeader />

		<main class="container mx-auto px-4 sm:px-6 py-8 flex-grow overflow-y-auto pb-24 sm:pb-32">
			<div class="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
				<div
					class="bg-gray-800 bg-opacity-70 rounded-lg shadow-lg p-4 sm:p-6 transition-transform duration-300">
					<h2 class="text-xl sm:text-2xl font-semibold mb-4 sm:mb-6 text-purple-300">인기 차트</h2>
					<div class="h-[350px] sm:h-[450px] overflow-y-auto pr-2 custom-scrollbar">
						<ul class="space-y-3 sm:space-y-4">
							<li v-for="song in popularChart" :key="song.rank"
								class="flex items-center p-2 rounded-lg hover:bg-gray-700 transition-colors duration-200">
								<span class="mr-2 sm:mr-4 text-lg sm:text-2xl font-bold text-purple-400 w-6 sm:w-8">{{
									song.rank }}</span>
								<img :src="song.coverUrl" :alt="song.title"
									class="w-10 h-10 sm:w-16 sm:h-16 object-cover rounded-lg mr-2 sm:mr-4 shadow-md">
								<div class="flex-grow min-w-0">
									<p class="font-medium text-sm sm:text-lg truncate">{{ song.title }}</p>
									<p class="text-xs sm:text-sm text-gray-300 truncate">{{ song.artist }}</p>
								</div>
								<button
									class="ml-2 text-gray-400 hover:text-purple-400 transition-colors duration-200 flex-shrink-0"
									@click="addToPlaylist(song)">
									<i class="fas fa-plus-circle text-base sm:text-xl"></i>
								</button>
							</li>
						</ul>
					</div>
				</div>

				<div class="lg:col-span-2">
					<div
						class="bg-gray-800 bg-opacity-70 rounded-lg shadow-lg p-4 sm:p-6 transition-transform duration-300">
						<h2 class="text-xl sm:text-2xl font-semibold mb-4 sm:mb-6 text-blue-300">내 플레이리스트</h2>
						<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
							<div v-for="playlist in myPlaylists" :key="playlist.id" class="relative group cursor-pointer">
								<img :src="playlist.cover" :alt="playlist.name"
									class="w-full aspect-square object-cover rounded-lg shadow-md transition-transform duration-300 group-hover:scale-105">
								<div
									class="absolute inset-0 bg-gradient-to-t from-black to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center p-2 sm:p-4">
									<p class="font-medium text-center text-sm sm:text-lg truncate">{{ playlist.name }}</p>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</main>

		<MusicPlayer :current-track="currentTrack" @toggle-queue="toggleQueue"
			class="sticky bottom-0 left-0 right-0 z-40" />

		<transition name="slide-up">
			<div v-if="showQueue" class="fixed inset-0 bg-black bg-opacity-50 z-50" @click="toggleQueue">
				<div class="absolute bottom-0 left-0 right-0 bg-gradient-to-b from-gray-900 to-gray-800 shadow-lg rounded-t-xl max-h-[80vh] overflow-hidden flex flex-col"
					@click.stop>
					<div class="p-4 bg-gray-800">
						<div class="w-12 h-1 bg-gray-600 rounded-full mx-auto mb-4"></div>
						<div class="flex justify-between items-center mb-4">
							<h2 class="text-xl font-semibold text-purple-300">재생 목록</h2>
							<button class="text-gray-400 hover:text-white transition-colors duration-200"
								@click="toggleQueue">
								<i class="fas fa-times"></i>
							</button>
						</div>
					</div>
					<ul class="flex-grow overflow-y-auto custom-scrollbar p-4 space-y-3">
						<li v-for="song in queue" :key="song.id"
							class="flex items-center p-3 rounded-lg bg-gray-700 bg-opacity-50 hover:bg-opacity-70 transition-colors duration-200">
							<img :src="song.coverUrl" :alt="song.title"
								class="w-12 h-12 object-cover rounded-lg mr-4 shadow-md">
							<div class="flex-grow min-w-0">
								<p class="font-medium text-white truncate">{{ song.title }}</p>
								<p class="text-sm text-gray-300 truncate">{{ song.artist }}</p>
							</div>
							<button class="text-gray-400 hover:text-white transition-colors duration-200 p-2">
								<i class="fas fa-ellipsis-v"></i>
							</button>
						</li>
					</ul>
				</div>
			</div>
		</transition>
	</div>
</template>

<script>
import { mapState, mapActions } from 'vuex'
import MusicPlayer from '~/components/MusicPlayer.vue'
import AppHeader from '~/components/AppHeader.vue';

export default {
	components: {
		MusicPlayer,
		AppHeader
	},
	computed: {
		...mapState('player', ['queue', 'currentTrack'])
	},
	data() {
		return {
			searchQuery: '',
			showQueue: false,
			popularChart: [],
			myPlaylists: [
				{ id: 1, name: '드라이브 뮤직', cover: 'https://via.placeholder.com/200x200' },
				{ id: 2, name: 'Chill Vibes', cover: 'https://via.placeholder.com/200x200' },
				{ id: 3, name: '운동할 때', cover: 'https://via.placeholder.com/200x200' },
				{ id: 4, name: 'K-Pop Hits', cover: 'https://via.placeholder.com/200x200' }
			],
			// currentTrack: {
			// 	id: 1,
			// 	title: 'Dynamite',
			// 	artist: 'BTS',
			// 	albumCover: 'https://via.placeholder.com/200x200'
			// },
			// queue: []
		}
	},
	methods: {
		...mapActions('player', ['addToPlaylist', 'setCurrentTrack']),
		// async addToPlaylist(song) {
		// 	try {
		// 		const { songData } = await this.$axios.$get(`/api/songs/songdata?title=${song.title}&artist=${song.artist}`)
		// 		this.queue.push(songData)
		// 		console.log('Added to playlist:', songData)
		// 	} catch (err) {

		// 	}
		// },
		toggleQueue() {
			this.showQueue = !this.showQueue;
		},
		async fetchPopularChart() {
			try {
				const { chart } = await this.$axios.$get('/api/songs/chart')
				this.popularChart = chart.items
			} catch (err) {

			}
		},
		handleKeyDown(e) {
			if (e.key === 'Escape' && this.showQueue) {
				this.closeQueue()
			}
		}
	},
	mounted() {
		this.fetchPopularChart()
		document.addEventListener('keydown', (e) => {
			if (e.key === 'Escape' && this.showQueue) {
				this.toggleQueue()
			}
		})
	},
	beforeDestroy() {
		document.removeEventListener('keydown', this.handleKeyDown)
	}
}
</script>

<style>
@import 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.3/css/all.min.css';

.slide-up-enter-active,
.slide-up-leave-active {
	transition: all 0.3s ease-out;
}

.slide-up-enter-from,
.slide-up-leave-to {
	transform: translateY(100%);
}

.custom-scrollbar {
	scrollbar-width: thin;
	scrollbar-color: rgba(155, 155, 155, 0.5) transparent;
}

.custom-scrollbar::-webkit-scrollbar {
	width: 4px;
}

.custom-scrollbar::-webkit-scrollbar-track {
	background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
	background-color: rgba(155, 155, 155, 0.5);
	border-radius: 20px;
	border: transparent;
}

/* 모바일에서 플레이어가 잘리지 않도록 패딩 조정 */
@media (max-width: 640px) {
	.pb-24 {
		padding-bottom: 5rem;
	}
}

/* 컨테이너의 최대 너비를 제한하여 좌우 스크롤 방지 */
.container {
	max-width: 100%;
	overflow-x: hidden;
}
</style>