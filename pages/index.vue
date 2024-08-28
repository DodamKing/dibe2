<template>
	<div class="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white">
		<header class="bg-black bg-opacity-50 shadow-lg p-4">
			<div class="container mx-auto flex justify-between items-center">
				<h1 class="text-2xl font-bold">DIBE2</h1>
				<div class="relative">
					<input v-model="searchQuery" type="text" placeholder="노래, 앨범, 아티스트 검색"
						class="bg-gray-800 text-white placeholder-gray-400 rounded-full py-2 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500">
					<i class="fas fa-search absolute right-3 top-3 text-gray-400"></i>
				</div>
			</div>
		</header>

		<main class="container mx-auto p-4 pb-24">
			<div class="grid grid-cols-1 md:grid-cols-3 gap-6">
				<div class="bg-gray-800 bg-opacity-50 rounded-lg shadow-lg p-4">
					<h2 class="text-xl font-semibold mb-4">인기 차트</h2>
					<ul>
						<li v-for="(song, index) in popularChart" :key="song.id" class="mb-3 flex items-center">
							<span class="mr-2 text-gray-400">{{ index + 1 }}</span>
							<img :src="song.albumCover" :alt="song.title" class="w-12 h-12 object-cover rounded mr-3">
							<div>
								<p class="font-medium">{{ song.title }}</p>
								<p class="text-sm text-gray-400">{{ song.artist }}</p>
							</div>
							<button class="ml-auto text-gray-400 hover:text-blue-500" @click="addToPlaylist(song)">
								<i class="fas fa-plus"></i>
							</button>
						</li>
					</ul>
				</div>

				<div class="md:col-span-2">
					<div class="bg-gray-800 bg-opacity-50 rounded-lg shadow-lg p-4">
						<h2 class="text-xl font-semibold mb-4">내 플레이리스트</h2>
						<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
							<div v-for="playlist in myPlaylists" :key="playlist.id"
								class="relative group cursor-pointer">
								<img :src="playlist.cover" :alt="playlist.name"
									class="w-full h-40 object-cover rounded-lg">
								<div
									class="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
									<p class="font-medium text-center">{{ playlist.name }}</p>
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</main>

		<MusicPlayer :current-track="currentTrack" @toggle-queue="toggleQueue" />

		<transition name="slide">
			<div v-if="showQueue" class="fixed top-0 right-0 bottom-0 w-80 bg-gray-800 shadow-lg overflow-y-auto">
				<div class="p-4">
					<div class="flex justify-between items-center mb-4">
						<h2 class="text-xl font-semibold">재생 목록</h2>
						<button class="text-gray-400 hover:text-white" @click="toggleQueue">
							<i class="fas fa-times"></i>
						</button>
					</div>
					<ul>
						<li v-for="song in queue" :key="song.id" class="mb-3 flex items-center">
							<img :src="song.albumCover" :alt="song.title" class="w-12 h-12 object-cover rounded mr-3">
							<div>
								<p class="font-medium">{{ song.title }}</p>
								<p class="text-sm text-gray-400">{{ song.artist }}</p>
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

export default {
	components: {
		MusicPlayer
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