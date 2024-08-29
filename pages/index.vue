<template>
	<div class="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white">
		<!-- <header class="bg-gradient-to-r from-purple-800 to-blue-700 shadow-lg p-4">
			<div class="container mx-auto flex justify-between items-center">
				<h1 class="text-2xl font-bold text-white">DIBE2</h1>
				<div class="relative">
					<input v-model="searchQuery" type="text" placeholder="노래, 앨범, 아티스트 검색"
						class="bg-white bg-opacity-20 text-white placeholder-gray-300 rounded-full py-2 px-4 focus:outline-none focus:ring-2 focus:ring-white focus:bg-opacity-30">
					<i class="fas fa-search absolute right-3 top-3 text-gray-300"></i>
				</div>
			</div>
		</header> -->
		<AppHeader />

		<main class="container mx-auto p-4 sm:p-6 pb-24">
			<div class="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
				<div class="bg-gray-800 bg-opacity-70 rounded-lg shadow-lg p-4 sm:p-6 transform hover:scale-105 transition-transform duration-300">
					<h2 class="text-xl sm:text-2xl font-semibold mb-4 sm:mb-6 text-purple-300">인기 차트</h2>
					<ul class="space-y-3 sm:space-y-4">
						<li v-for="(song, index) in popularChart" :key="song.id" class="flex items-center p-2 rounded-lg hover:bg-gray-700 transition-colors duration-200">
							<span class="mr-3 sm:mr-4 text-xl sm:text-2xl font-bold text-purple-400">{{ index + 1 }}</span>
							<img :src="song.albumCover" :alt="song.title" class="w-12 h-12 sm:w-16 sm:h-16 object-cover rounded-lg mr-3 sm:mr-4 shadow-md">
							<div class="flex-grow min-w-0">
								<p class="font-medium text-base sm:text-lg truncate">{{ song.title }}</p>
								<p class="text-sm text-gray-300 truncate">{{ song.artist }}</p>
							</div>
							<button class="ml-2 text-gray-400 hover:text-purple-400 transition-colors duration-200 flex-shrink-0" @click="addToPlaylist(song)">
								<i class="fas fa-plus-circle text-lg sm:text-xl"></i>
							</button>
						</li>
					</ul>
				</div>

				<div class="lg:col-span-2">
					<div class="bg-gray-800 bg-opacity-70 rounded-lg shadow-lg p-4 sm:p-6 transform hover:scale-105 transition-transform duration-300">
						<h2 class="text-xl sm:text-2xl font-semibold mb-4 sm:mb-6 text-blue-300">내 플레이리스트</h2>
						<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
							<div v-for="playlist in myPlaylists" :key="playlist.id"
								class="relative group cursor-pointer">
								<img :src="playlist.cover" :alt="playlist.name"
									class="w-full aspect-square object-cover rounded-lg shadow-md transition-transform duration-300 group-hover:scale-105">
								<div
									class="absolute inset-0 bg-gradient-to-t from-black to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center p-2 sm:p-4">
									<p class="font-medium text-center text-base sm:text-lg truncate">{{ playlist.name }}</p>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</main>

		<MusicPlayer :current-track="currentTrack" @toggle-queue="toggleQueue" />

		<transition name="slide">
			<div v-if="showQueue" class="fixed top-0 right-0 bottom-0 w-64 sm:w-80 bg-gray-800 shadow-lg overflow-y-auto">
				<div class="p-4">
					<div class="flex justify-between items-center mb-4">
						<h2 class="text-xl font-semibold text-purple-300">재생 목록</h2>
						<button class="text-gray-400 hover:text-white transition-colors duration-200" @click="toggleQueue">
							<i class="fas fa-times"></i>
						</button>
					</div>
					<ul class="space-y-3">
						<li v-for="song in queue" :key="song.id" class="flex items-center p-2 rounded-lg hover:bg-gray-700 transition-colors duration-200">
							<img :src="song.albumCover" :alt="song.title" class="w-12 h-12 object-cover rounded-lg mr-3 shadow-md">
							<div class="flex-grow min-w-0">
								<p class="font-medium truncate">{{ song.title }}</p>
								<p class="text-sm text-gray-400 truncate">{{ song.artist }}</p>
							</div>
						</li>
					</ul>
				</div>
			</div>
		</transition>
	</div>
</template>

<script>
import MusicPlayer from '~/components/MusicPlayer.vue'
import AppHeader from '~/components/AppHeader.vue';

export default {
	components: {
		MusicPlayer,
		AppHeader
	},
	data() {
		return {
			searchQuery: '',
			showQueue: false,
			popularChart: [
				{ id: 1, title: '눈물이 바다 되어', artist: '이지은', albumCover: 'https://via.placeholder.com/100x100' },
				{ id: 2, title: 'Butter', artist: 'BTS', albumCover: 'https://via.placeholder.com/100x100' },
				{ id: 3, title: '신호등', artist: '이무진', albumCover: 'https://via.placeholder.com/100x100' },
				{ id: 4, title: 'Dynamite', artist: 'BTS', albumCover: 'https://via.placeholder.com/100x100' },
				{ id: 5, title: 'Savage Love', artist: 'Jawsh 685 x Jason Derulo', albumCover: 'https://via.placeholder.com/100x100' }
			],
			myPlaylists: [
				{ id: 1, name: '드라이브 뮤직', cover: 'https://via.placeholder.com/200x200' },
				{ id: 2, name: 'Chill Vibes', cover: 'https://via.placeholder.com/200x200' },
				{ id: 3, name: '운동할 때', cover: 'https://via.placeholder.com/200x200' },
				{ id: 4, name: 'K-Pop Hits', cover: 'https://via.placeholder.com/200x200' }
			],
			currentTrack: {
				id: 1,
				title: 'Dynamite',
				artist: 'BTS',
				albumCover: 'https://via.placeholder.com/200x200'
			},
			queue: [
				{ id: 1, title: '밤편지', artist: '아이유', albumCover: 'https://via.placeholder.com/100x100' },
				{ id: 2, title: 'Spring Day', artist: 'BTS', albumCover: 'https://via.placeholder.com/100x100' },
				{ id: 3, title: 'Blueming', artist: '아이유', albumCover: 'https://via.placeholder.com/100x100' }
			]
		}
	},
	methods: {
		addToPlaylist(song) {
			// 플레이리스트에 추가하는 로직 구현
			console.log('Added to playlist:', song.title)
		},
		toggleQueue() {
			this.showQueue = !this.showQueue
		}
	},
	mounted() {
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

.slide-enter-active,
.slide-leave-active {
	transition: transform 0.3s ease;
}

.slide-enter,
.slide-leave-to {
	transform: translateX(100%);
}
</style>