<template>
    <div class="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white">
        <main v-if="loading" class="container mx-auto px-4 sm:px-6 py-8 flex justify-center items-center">
            <div class="text-2xl">로딩 중...</div>
        </main>

        <main v-else-if="!currentPlaylist" class="container mx-auto px-4 sm:px-6 py-8 flex justify-center items-center flex-col">
            <div class="text-2xl mb-4">플레이리스트를 찾을 수 없습니다.</div>
            <button @click="$router.push('/')" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded">
                홈으로 돌아가기
            </button>
        </main>

        <main v-else class="container mx-auto px-4 sm:px-6 py-8">
            <div class="bg-gray-800 rounded-lg shadow-lg p-6">
                <div class="flex items-center mb-6">
                    <img :src="currentPlaylist.coverUrl || 'https://via.placeholder.com/100x100'" alt="Playlist Cover" class="w-32 h-32 object-cover rounded-lg mr-6">
                    <div>
                        <h1 class="text-3xl font-bold mb-2">{{ currentPlaylist.name }}</h1>
                        <p class="text-gray-400">{{ currentPlaylist.songs.length }}곡 • {{ formatTotalDuration }}</p>
                    </div>
                </div>

                <div class="flex space-x-4 mb-6">
                    <button @click="playAll" :disabled="!currentPlaylist.songs.length" class="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed">
                        전체 재생
                    </button>
                    <button @click="shufflePlay" :disabled="!currentPlaylist.songs.length" class="bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed">
                        랜덤 재생
                    </button>
                    <button @click="showEditModal = true" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded">
                        편집
                    </button>
                </div>

                <div v-if="!currentPlaylist.songs.length" class="text-center py-8">
                    <p class="text-xl text-gray-400">이 플레이리스트에는 아직 곡이 없습니다.</p>
                    <p class="text-sm text-gray-500 mt-2">좋아하는 곡을 추가해보세요!</p>
                </div>

                <ul v-else class="space-y-2">
                    <li v-for="(song, index) in currentPlaylist.songs" :key="song._id"
                        class="flex items-center p-2 hover:bg-gray-700 rounded">
                        <span class="mr-4 text-gray-400">{{ index + 1 }}</span>
                        <img :src="song.coverUrl" :alt="song.title" class="w-10 h-10 object-cover rounded mr-4">
                        <div class="flex-grow">
                            <p class="font-medium">{{ song.title }}</p>
                            <p class="text-sm text-gray-400">{{ song.artist }}</p>
                        </div>
                        <span class="text-gray-400">{{ formatDuration(song.duration) }}</span>
                        <button @click="removeSong(song)" class="ml-4 text-red-500 hover:text-red-600">
                            <i class="fas fa-trash"></i>
                        </button>
                    </li>
                </ul>
            </div>
        </main>

        <!-- <EditPlaylistModal v-if="showEditModal" :playlist="currentPlaylist" @close="showEditModal = false"
            @update="updatePlaylist" /> -->
    </div>
</template>

<script>
import { mapState, mapActions } from 'vuex'
// import EditPlaylistModal from '~/components/EditPlaylistModal.vue'

export default {
    components: {
        // EditPlaylistModal
    },
    data() {
        return {
            showQueue: false,
            showEditModal: false,
            loading: true,
            error: null
        }
    },
    computed: {
        ...mapState('player', ['currentTrack']),
        ...mapState('playlist', ['currentPlaylist']),
        formatTotalDuration() {
            if (!this.currentPlaylist || !this.currentPlaylist.songs) return '0:00';
            const totalSeconds = this.currentPlaylist.songs.reduce((total, song) => total + (song.duration || 0), 0);
            return this.formatDuration(totalSeconds);
        }
    },
    methods: {
        ...mapActions('player', ['setQueue', 'setCurrentTrack']),
        ...mapActions('playlist', ['fetchPlaylistDetail', 'updatePlaylist', 'removeSongsFromPlaylist']),
        formatDuration(seconds) {
            const minutes = Math.floor(seconds / 60)
            const remainingSeconds = seconds % 60
            return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
        },
        playAll() {
            if (this.currentPlaylist.songs.length) {
                this.setQueue(this.currentPlaylist.songs)
                this.setCurrentTrack(this.currentPlaylist.songs[0])
            }
        },
        shufflePlay() {
            if (this.currentPlaylist.songs.length) {
                const shuffled = [...this.currentPlaylist.songs].sort(() => Math.random() - 0.5)
                this.setQueue(shuffled)
                this.setCurrentTrack(shuffled[0])
            }
        },
        toggleQueue() {
            this.showQueue = !this.showQueue
        },
        async removeSong(song) {
            try {
                const result = await this.removeSongsFromPlaylist({ 
                    playlistId: this.currentPlaylist._id, 
                    songIds: [song.songId] 
                })
                if (result.success) {
                    this.$toast.success(`${result.removedCount}곡이 플레이리스트에서 제거되었습니다.`)
                    // 플레이리스트 정보 다시 불러오기
                    await this.fetchPlaylistDetail(this.currentPlaylist._id)
                }
            } catch (error) {
                this.$toast.error('곡 제거 중 오류가 발생했습니다.')
            }
        },
        async updatePlaylist(updatedData) {
            try {
                await this.updatePlaylist({ id: this.currentPlaylist._id, ...updatedData })
                this.showEditModal = false
                this.$toast.success('플레이리스트가 업데이트되었습니다.')
                // 플레이리스트 정보 다시 불러오기
                await this.fetchPlaylistDetail(this.currentPlaylist._id)
            } catch (error) {
                this.$toast.error('플레이리스트 업데이트 중 오류가 발생했습니다.')
            }
        }
    },
    async mounted() {
        this.loading = true
        try {
            const success = await this.fetchPlaylistDetail(this.$route.params.id)
            if (!success) {
                this.error = '플레이리스트를 찾을 수 없습니다.'
            }
        } catch (error) {
            console.error('Error fetching playlist:', error)
            this.error = '플레이리스트를 불러오는 데 실패했습니다.'
        } finally {
            this.loading = false
        }
    }
}
</script>