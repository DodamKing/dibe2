<template>
	<main class="container mx-auto px-4 sm:px-6 py-8 flex-grow overflow-y-auto pb-24 sm:pb-32">
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 mb-10">
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
							<button @click="showAddToPlaylistModal" :disabled="selectedSongs.length === 0"
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
						</li>
					</ul>
				</div>
			</div>

			<div class="lg:col-span-2">
				<MyPlaylistSection :playlists="playlists" @create-playlist="showCreatePlaylistModal"
					@delete-playlist="deletePlaylist" @select-playlist="selectPlaylist" />
			</div>
		</div>
	</main>
</template>

<script>
import MyPlaylistSection from '~/components/MyPlaylistSection.vue'

export default {
	layout: 'main',
	components: {
		MyPlaylistSection,
	},
	inject: ['layoutMethods', 'layoutData'],
	computed: {
		popularChart() {
			return this.layoutData.popularChart()
		},
		lastChartUpdated() {
			return this.layoutData.lastChartUpdated()
		},
		playlists() {
			return this.layoutData.playlists()
		},
		selectedSongs() {
			return this.layoutData.selectedSongs()
		},
		allSelected() {
			return this.layoutData.allSelected()
		},
		showCreatePlaylistModalFlag() {
			return this.layoutData.showCreatePlaylistModalFlag()
		},
	},
	methods: {
		selectAll() {
			this.layoutMethods.selectAll()
		},
		showAddToPlaylistModal() {
			this.layoutMethods.showAddToPlaylistModal()
		},
		isSongSelected(song) {
			return this.layoutMethods.isSongSelected(song)
		},
		toggleSongSelection(song) {
			this.layoutMethods.toggleSongSelection(song)
		},
		showCreatePlaylistModal() {
			this.layoutMethods.showCreatePlaylistModal()
		},
		deletePlaylist(playlistId) {
			this.layoutMethods.deletePlaylist(playlistId)
		},
		selectPlaylist(playlistId) {
			this.$router.push(`/playlist/${playlistId}`)
		},
	}
}
</script>