<template>
	<div class="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white flex flex-col">
		<AppHeader />

		<main class="container mx-auto px-4 sm:px-6 py-8 flex-grow overflow-y-auto pb-24 sm:pb-32">
			<div class="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
				<div
					class="bg-gray-800 bg-opacity-70 rounded-lg shadow-lg p-4 sm:p-6 transition-transform duration-300">
					<div class="sticky top-0 z-10 pb-4">
						<div class="flex justify-between items-center">
							<h2 class="text-xl sm:text-2xl font-semibold text-purple-300">오늘 Top 100</h2>
							<div class="flex space-x-2">
								<button @click="selectAll"
									class="bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-3 rounded text-sm">
									{{ allSelected ? '전체 해제' : '전체 선택' }}
								</button>
								<button @click="_showAddToPlaylistModal" :disabled="selectedSongs.length === 0"
									class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-3 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed">
									추가 ({{ selectedSongs.length }})
								</button>
							</div>
						</div>
						<div class="text-sm text-gray-400">{{ lastChartUpdated }} 업데이트</div>
					</div>

					<div class="h-[320px] overflow-y-auto pr-2 custom-scrollbar">
						<ul class="space-y-3">
							<li v-for="song in popularChart" :key="`${song.title}-${song.artist}`"
								class="flex items-center p-2 rounded-lg hover:bg-gray-700 transition-colors duration-200">
								<input type="checkbox" :checked="isSongSelected(song)"
									@change="toggleSongSelection(song)"
									class="mr-2 form-checkbox h-4 w-4 text-purple-600" />
								<span class="mr-2 text-lg font-bold text-purple-400 w-6">
									{{ song.rank }}
								</span>
								<img :src="song.coverUrl" :alt="song.title"
									class="w-10 h-10 object-cover rounded-lg mr-2 shadow-md" />
								<div class="flex-grow min-w-0 mr-2">
									<p class="font-medium text-sm truncate">{{ song.title }}</p>
									<p class="text-xs text-gray-300 truncate">{{ song.artist }}</p>
								</div>
								<!-- <div class="flex-shrink-0 flex space-x-1">
									<button
										class="text-gray-400 hover:text-purple-400 transition-colors duration-200 mr-1"
										@click="addToPlaylist(song)">
										<i class="fas fa-plus-circle text-base"></i>
									</button>
									<button class="text-gray-400 hover:text-blue-400 transition-colors duration-200"
										@click="showPlaylistSelection(song)">
										<i class="fas fa-list text-base"></i>
									</button>
								</div> -->
							</li>
						</ul>
					</div>
				</div>

				<div class="lg:col-span-2">
					<MyPlaylistSection :playlists="playlists" @create-playlist="showCreatePlaylistModal = true"
						@delete-playlist="_deletePlaylist" />
				</div>
			</div>
		</main>

		<MusicPlayer :current-track="currentTrack" @toggle-queue="toggleQueue"
			class="sticky bottom-0 left-0 right-0 z-40" />

		<!-- 재생 목록 섹션 -->
		<Playlist :show="showQueue" @close="toggleQueue" />

		<!-- Playlist Selection Modal -->
		<!-- <transition name="slide-up">
			<div v-if="showPlaylistSelectionModal"
				class="modal fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
				<div class="bg-gray-800 rounded-lg p-6 max-w-sm w-full">
					<h3 class="text-xl font-semibold mb-4">플레이리스트 선택</h3>
					<ul class="space-y-2">
						<li v-for="playlist in playlists" :key="playlist._id">
							<button @click="addToSelectedPlaylist(playlist._id)"
								class="w-full text-left p-2 rounded hover:bg-gray-700 transition-colors duration-200">
								{{ playlist.name }}
							</button>
						</li>
					</ul>
					<button @click="closePlaylistSelection"
						class="mt-4 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">
						취소
					</button>
				</div>
			</div>
		</transition> -->

		<CreatePlaylistModal :show="showCreatePlaylistModal" @close="showCreatePlaylistModal = false"
			@create="handleCreatePlaylist" @show-toast="showToast" />

		<!-- Toast Message -->
		<transition name="fade">
			<div v-if="toastVisible"
				class="fixed bottom-24 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg">
				{{ toastMessage }}
			</div>
		</transition>

		<!-- Loading Overlay -->
		<div v-if="isAdding" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
			<div class="bg-gray-800 rounded-lg p-6 max-w-sm w-full text-center">
				<svg class="animate-spin h-10 w-10 text-blue-500 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg"
					fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z">
					</path>
				</svg>
				<p class="text-lg font-semibold mb-2">곡 추가 중...</p>
				<div class="w-full bg-gray-700 rounded-full h-2.5 dark:bg-gray-700 mt-4">
					<div class="bg-blue-600 h-2.5 rounded-full" :style="{ width: `${progressPercentage}%` }"></div>
				</div>
			</div>
		</div>

		<!-- Add to Playlist Modal -->
		<transition name="slide-up">
			<div v-if="showAddToPlaylistModal"
				class="modal fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
				<div class="bg-gray-800 rounded-lg p-6 max-w-sm w-full">
					<h3 class="text-xl font-semibold mb-4">플레이리스트 선택</h3>
					<ul class="space-y-2 mb-4">
						<li>
							<button @click="addToCurrentPlaylist"
								class="w-full text-left p-2 rounded hover:bg-gray-700 transition-colors duration-200">
								현재 재생 목록에 추가
							</button>
						</li>
						<li v-for="playlist in playlists" :key="playlist._id">
							<button @click="addToSelectedPlaylist(playlist._id)"
								class="w-full text-left p-2 rounded hover:bg-gray-700 transition-colors duration-200">
								{{ playlist.name }}
							</button>
						</li>
					</ul>
					<button @click="closeAddToPlaylistModal"
						class="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">
						취소
					</button>
				</div>
			</div>
		</transition>
	</div>
</template>

<script>
import dayjs from 'dayjs'
import 'dayjs/locale/ko'
import { mapState, mapActions } from 'vuex'
import MusicPlayer from '~/components/MusicPlayer.vue'
import AppHeader from '~/components/AppHeader.vue'
import Playlist from '~/components/Playlist.vue'
import CreatePlaylistModal from '~/components/CreatePlaylistModal.vue'
import MyPlaylistSection from '~/components/MyPlaylistSection.vue'

export default {
	watch: {
		isAdding(newValue) {
			if (newValue) {
				this.startProgress()
			} else {
				this.stopProgress()
			}
		}
	},
	components: {
		MusicPlayer,
		AppHeader,
		Playlist,
		CreatePlaylistModal,
		MyPlaylistSection,
	},
	computed: {
		...mapState('player', ['queue', 'currentTrack']),
		...mapState('playlist', ['playlists']),
		allSelected() {
			return this.selectedSongs.length === this.popularChart.length
		}
	},
	data() {
		return {
			searchQuery: '',
			showQueue: false,
			popularChart: [],
			lastChartUpdated: '',
			selectedSongs: [],
			showPlaylistSelectionModal: false,
			currentSongForPlaylist: null,
			toastVisible: false,
			toastMessage: '',
			isAdding: false,
			progressPercentage: 0,
			showSearchResults: false,
			searchResults: [],
			showCreatePlaylistModal: false,
			showDropdown: false,
			showAddToPlaylistModal: false,
		}
	},
	methods: {
		...mapActions('player', ['addToPlaylist', 'setCurrentTrack', 'addMultipleToPlaylist', 'initializeQueue']),
		...mapActions('playlist', ['fetchPlaylists', 'createPlaylist', 'deletePlaylist', 'addSongsToPlaylist']),
		toggleQueue() {
			this.showQueue = !this.showQueue;
		},
		async fetchPopularChart() {
			try {
				const { chart } = await this.$axios.$get('/api/songs/chart')
				this.popularChart = chart.items
				this.lastChartUpdated = dayjs(chart.lastUpdated).locale('ko').format('M월 D일 A h시')
			} catch (err) {

			}
		},
		handleKeyDown(e) {
			if (e.key === 'Escape' && this.showQueue) {
				this.closeQueue()
			}
		},
		toggleSongSelection(song) {
			const index = this.selectedSongs.findIndex(s => s.title === song.title && s.artist === song.artist)
			if (index === -1) {
				this.selectedSongs.push(song)
			} else {
				this.selectedSongs.splice(index, 1)
			}
		},
		isSongSelected(song) {
			return this.selectedSongs.some(s => s.title === song.title && s.artist === song.artist)
		},
		selectAll() {
			if (this.allSelected) {
				this.selectedSongs = []
			} else {
				this.selectedSongs = [...this.popularChart]
			}
		},
		// async addSelectedToPlaylist() {
		// 	if (this.isAdding) return

		// 	this.isAdding = true
		// 	try {
		// 		const uniqueSongs = this.selectedSongs.filter(
		// 			song => !this.queue.some(queueSong => queueSong.title === song.title && queueSong.artist === song.artist)
		// 		)

		// 		const addedCount = await this.addMultipleToPlaylist(uniqueSongs)

		// 		this.showToast(`${addedCount}곡이 재생목록에 추가되었습니다.`)
		// 		this.selectedSongs = []
		// 	} catch (err) {
		// 		console.error('Failed to add songs to playlist:', err)
		// 		this.showToast('곡을 재생목록에 추가하는 데 실패했습니다.')
		// 	} finally {
		// 		this.isAdding = false
		// 	}
		// },
		_showAddToPlaylistModal() {
			this.showAddToPlaylistModal = true
		},
		closeAddToPlaylistModal() {
			this.showAddToPlaylistModal = false
		},
		async addToCurrentPlaylist() {
			if (this.isAdding) return

			this.isAdding = true
			try {
				const addedCount = await this.addMultipleToPlaylist(this.selectedSongs)
				this.showToast(`${addedCount}곡이 현재 재생목록에 추가되었습니다.`)
				this.selectedSongs = []
			} catch (err) {
				console.error('Failed to add songs to current playlist:', err)
				this.showToast('곡을 현재 재생목록에 추가하는 데 실패했습니다.')
			} finally {
				this.isAdding = false
				this.closeAddToPlaylistModal()
			}
		},
		async addToSelectedPlaylist(playlistId) {
			if (this.isAdding) return

			this.isAdding = true
			try {
				const { success, addedSongs} = await this.addSongsToPlaylist({ playlistId, songs: this.selectedSongs })
				if (success) this.showToast(`${addedSongs}곡이 선택한 플레이리스트에 추가되었습니다.`)
				else this.showToast('예기치 못한 에러 발생으로 곡 추가에 실패했습니다.')
				this.selectedSongs = []
			} catch (err) {
				console.error('Failed to add songs to playlist:', err)
				this.showToast('곡을 플레이리스트에 추가하는 데 실패했습니다.')
			} finally {
				this.isAdding = false
				this.closeAddToPlaylistModal()
			}
		},
		// showPlaylistSelection(song) {
		// 	this.currentSongForPlaylist = song
		// 	this.showPlaylistSelectionModal = true
		// },
		// closePlaylistSelection() {
		// 	this.showPlaylistSelectionModal = false
		// 	this.currentSongForPlaylist = null
		// },
		showToast(message) {
			this.toastMessage = message
			this.toastVisible = true
			setTimeout(() => {
				this.toastVisible = false
			}, 3000)
		},
		playSong(song) {
			this.setCurrentTrack(song)
		},
		startProgress() {
			this.progressPercentage = 0
			this.intervalId = setInterval(() => {
				if (this.progressPercentage < 90) {
					this.progressPercentage += Math.random() * 15 + 5
					if (this.progressPercentage > 90) {
						this.progressPercentage = 90
					}
				}
			}, 100)
		},
		stopProgress() {
			clearInterval(this.intervalId)
			this.progressPercentage = 100
			setTimeout(() => {
				this.progressPercentage = 0
			}, 300)
		},
		async handleCreatePlaylist(name) {
			try {
				await this.createPlaylist(name);
				this.showCreatePlaylistModal = false;
				this.showToast('새 플레이리스트가 생성되었습니다.');
			} catch (error) {
				this.showToast('플레이리스트 생성에 실패했습니다.');
			}
		},
		toggleDropdown() {
			this.showDropdown = !this.showDropdown
		},
		async _deletePlaylist(playlistId) {
			try {
				await this.deletePlaylist(playlistId)
				this.showToast('플레이리스트 삭제되었습니다.')
			} catch (err) {
				this.showToast('플레이리스트 삭제에 실패했습니다.')
			}
		},
	},
	mounted() {
		this.fetchPopularChart()
		document.addEventListener('keydown', this.handleKeyDown)
		this.fetchPlaylists()
		// this.$store.dispatch('player/initializeQueue')
		// this.$store.dispatch('player/initializeAudioSystem')
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

.container {
	max-width: 100%;
	overflow-x: hidden;
}

@keyframes spin {
	from {
		transform: rotate(0deg);
	}

	to {
		transform: rotate(360deg);
	}
}

.animate-spin {
	animation: spin 1s linear infinite;
}

@media (max-width: 640px) {
	.pb-24 {
		padding-bottom: 5rem;
	}

	button,
	a {
		min-height: 44px;
		min-width: 44px;
	}
}

@media (hover: none) and (pointer: coarse) {
	.custom-scrollbar {
		-webkit-overflow-scrolling: touch;
	}
}
</style>