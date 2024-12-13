<template>
    <div class="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white flex flex-col">
        <AppHeader />
        <Nuxt />

        <div id="youtube-player" class="hidden"></div>
        <Playlist :show="showQueue" @close="toggleQueue" class="z-40" />
        <MusicPlayer :current-track="currentTrack" @toggle-queue="toggleQueue" class="z-50" />

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
        <div v-if="isAdding" class="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center">
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
        <transition name="fade">
            <div v-if="showAddToPlaylistModal"
                class="modal fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center"
                @click.self="closeAddToPlaylistModal">
                <div class="bg-gray-800 rounded-lg p-6 max-w-sm w-full relative">
                    <button @click="closeAddToPlaylistModal"
                        class="absolute top-2 right-2 text-gray-400 hover:text-white">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                    <h3 class="text-xl font-semibold mb-4">플레이리스트 선택</h3>
                    <ul class="space-y-2 mb-4">
                        <li>
                            <button @click="addToCurrentPlaylist"
                                class="w-full text-left p-2 rounded hover:bg-gray-700 transition-colors duration-200">
                                현재 재생 목록에 추가
                            </button>
                        </li>
                        <li>
                            <button @click="toggleMyPlaylists"
                                class="w-full text-left p-2 rounded hover:bg-gray-700 transition-colors duration-200 flex justify-between items-center">
                                <span>내 플레이리스트에 추가</span>
                                <span class="transform transition-transform duration-200"
                                    :class="{ 'rotate-180': showMyPlaylists }">▼</span>
                            </button>
                            <transition name="fade">
                                <ul v-if="showMyPlaylists" class="mt-2 ml-4 space-y-2">
                                    <li v-for="playlist in playlists" :key="playlist._id">
                                        <button @click="addToSelectedPlaylist(playlist._id)"
                                            class="w-full text-left p-2 rounded hover:bg-gray-700 transition-colors duration-200">
                                            {{ playlist.name }}
                                        </button>
                                    </li>
                                </ul>
                            </transition>
                        </li>
                    </ul>
                </div>
            </div>
        </transition>

        <!-- 푸터 -->
        <!-- 내가 만들었음 -->
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

export default {
    provide() {
        return {
            layoutMethods: {
                selectAll: this.selectAll,
                showAddToPlaylistModal: this._showAddToPlaylistModal,
                isSongSelected: this.isSongSelected,
                toggleSongSelection: this.toggleSongSelection,
                showCreatePlaylistModal: this._showCreatePlaylistModal,
                deletePlaylist: this._deletePlaylist,
                // 필요한 다른 메서드들도 여기에 추가
            },
            layoutData: {
                popularChart: () => this.popularChart,
                lastChartUpdated: () => this.lastChartUpdated,
                playlists: () => this.playlists,
                selectedSongs: () => this.selectedSongs,
                allSelected: () => this.allSelected,
                // 필요한 다른 데이터들도 여기에 추가
            }
        }
    },
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
    },
    computed: {
        ...mapState('player', ['queue', 'currentTrack']),
        ...mapState('playlist', ['playlists']),
        allSelected() {
            return this.selectedSongs.length === this.popularChart.length
        },
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
            showMyPlaylists: false,
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
                this.toggleQueue()
            }

            if (e.key === 'Escape' && this.showAddToPlaylistModal) {
                this.closeAddToPlaylistModal();
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
        _showAddToPlaylistModal() {
            this.showAddToPlaylistModal = true
        },
        closeAddToPlaylistModal() {
            this.showAddToPlaylistModal = false
            this.showMyPlaylists = false
        },
        async addToCurrentPlaylist() {
            if (this.isAdding) return

            const TOAST_MESSAGES = {
                QUEUE_FULL: '재생목록이 가득 찼습니다. 일부 곡을 제거해주세요.',
                QUEUE_LIMIT_EXCEEDED: (remaining) => `재생목록에 ${remaining}곡만 더 추가할 수 있습니다.`,
                ALL_DUPLICATES: '선택한 모든 곡이 이미 재생목록에 있습니다.',
                SUCCESS: (added, duplicates) => {
                    const duplicateMsg = duplicates ? ` (중복 ${duplicates}곡 제외)` : ''
                    return `${added}곡이 현재 재생목록에 추가되었습니다.${duplicateMsg}`
                },
                ERROR: '곡을 현재 재생목록에 추가하는 데 실패했습니다.'
            }

            this.isAdding = true
            try {
                const result = await this.addMultipleToPlaylist(this.selectedSongs)
                const message = result.message === 'QUEUE_LIMIT_EXCEEDED' ? TOAST_MESSAGES[result.message](result.remaining)
                    : result.message === 'SUCCESS' ? TOAST_MESSAGES[result.message](result.added, result.duplicates)
                        : TOAST_MESSAGES[result.message] || TOAST_MESSAGES.ERROR

                this.showToast(message)

                if (result.message === 'SUCCESS') {
                    this.selectedSongs = []
                }
            } catch (err) {
                console.error('Failed to add songs to current playlist:', err)
                this.showToast(TOAST_MESSAGES.ERROR)
            } finally {
                this.isAdding = false
                this.closeAddToPlaylistModal()
            }
        },
        async addToSelectedPlaylist(playlistId) {
            if (this.isAdding) return

            this.isAdding = true
            try {
                const { success, addedSongs } = await this.addSongsToPlaylist({ playlistId, songs: this.selectedSongs })
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
            clearInterval(this.intervalId)
            this.intervalId = setInterval(() => {
                if (this.progressPercentage < 90) {
                    this.progressPercentage += Math.random() * 15 + 5
                    if (this.progressPercentage > 90) {
                        const increment = Math.random() * 10 + 2
                        this.progressPercentage = Math.min(90, this.progressPercentage + increment)
                    }
                }
            }, 200)
        },
        stopProgress() {
            clearInterval(this.intervalId)
            this.progressPercentage = 100
            setTimeout(() => {
                this.isAdding = false
                this.progressPercentage = 0
            }, 500)
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
        _showCreatePlaylistModal() {
            this.showCreatePlaylistModal = true
        },
        toggleMyPlaylists() {
            this.showMyPlaylists = !this.showMyPlaylists;
        },
    },
    mounted() {
        this.fetchPopularChart()
        document.addEventListener('keydown', this.handleKeyDown)
        this.fetchPlaylists()
        this.$store.dispatch('player/initializeAudioSystem')
    },
    beforeDestroy() {
        document.removeEventListener('keydown', this.handleKeyDown)
    }
}
</script>

<style>
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

.slide-up-enter-active,
.slide-up-leave-active {
    transition: all 0.3s ease-out;
}

.slide-up-enter-from,
.slide-up-leave-to {
    transform: translateY(100%);
}

/* 모바일 환경을 위한 추가 스타일 */
@media (max-width: 640px) {
    .fixed.bottom-0 {
        padding-bottom: env(safe-area-inset-bottom);
    }
}
</style>