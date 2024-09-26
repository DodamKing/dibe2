<template>
    <main class="container-fluid px-4 sm:px-6 py-4 flex-grow overflow-y-auto">
        <div v-if="loading" class="flex justify-center items-center h-full">
            <div class="text-2xl">로딩 중...</div>
        </div>

        <div v-else-if="!currentPlaylist" class="flex justify-center items-center h-full flex-col">
            <div class="text-2xl mb-4">플레이리스트를 찾을 수 없습니다.</div>
            <button @click="$router.push('/')"
                class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded">
                홈으로 돌아가기
            </button>
        </div>

        <div v-else class="grid grid-cols-1 gap-6">
            <div class="bg-gray-800 bg-opacity-70 rounded-lg shadow-lg p-4 sm:p-6 transition-transform duration-300">
                <div class="sticky top-0 z-10 pb-4">
                    <button @click="$router.go(-1)" class="mb-4 text-gray-400 hover:text-white">
                        <i class="fas fa-arrow-left mr-2"></i>뒤로 가기
                    </button>
                    <div class="flex items-center mb-4">
                        <div class="w-24 h-24 sm:w-32 sm:h-32 grid grid-cols-2 gap-1 rounded-lg overflow-hidden mr-4">
                            <template v-for="(song, index) in (currentPlaylist.songs.slice(0, 4) || [])">
                                <img v-if="index === 0 || currentPlaylist.songs.length > 1" :key="index"
                                    :src="song.coverUrl.replace('/50/', '/100/') || 'https://via.placeholder.com/100x100'"
                                    :alt="song.title" :class="[
                                        'w-full h-full object-cover',
                                        { 'col-span-2 row-span-2': currentPlaylist.songs.length === 1 }
                                    ]">
                            </template>
                        </div>
                        <div>
                            <h1 class="text-2xl sm:text-3xl font-bold mb-1">{{ currentPlaylist.name }}</h1>
                            <p class="text-sm sm:text-base text-gray-400">{{ currentPlaylist.songs.length }}곡 {{ estimatedDuration }}
                            </p>
                        </div>
                    </div>
                    <div class="flex space-x-2">
                        <button @click="playAll" :disabled="!currentPlaylist.songs.length"
                            class="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-3 rounded text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed">
                            전체 재생
                        </button>
                        <button @click="shufflePlay" :disabled="!currentPlaylist.songs.length"
                            class="bg-purple-500 hover:bg-purple-600 text-white font-bold py-2 px-3 rounded text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed">
                            랜덤 재생
                        </button>
                    </div>
                </div>

                <div class="overflow-y-auto pr-2 custom-scrollbar mt-4" style="height: calc(100vh - 480px);">
                    <ul v-if="currentPlaylist.songs.length" class="space-y-3">
                        <li v-for="(song, index) in currentPlaylist.songs" :key="song._id"
                            class="flex items-center p-2 rounded-lg hover:bg-gray-700 transition-colors duration-200">
                            <span class="mr-2 text-lg font-bold text-purple-400 w-6">
                                {{ index + 1 }}
                            </span>
                            <img :src="song.coverUrl || 'https://via.placeholder.com/40x40'" :alt="song.title"
                                class="w-10 h-10 sm:w-12 sm:h-12 object-cover rounded-lg mr-2 shadow-md" />
                            <div class="flex-grow min-w-0 mr-2">
                                <p class="font-medium text-sm sm:text-base truncate">{{ song.title }}</p>
                                <p class="text-xs sm:text-sm text-gray-300 truncate">{{ song.artist }}</p>
                            </div>
                            <button @click="removeSong(song)" class="text-red-500 hover:text-red-600 flex-shrink-0">
                                <i class="fas fa-trash"></i>
                            </button>
                        </li>
                    </ul>
                    <div v-else class="text-center py-8">
                        <p class="text-xl text-gray-400">이 플레이리스트에는 아직 곡이 없습니다.</p>
                        <p class="text-sm text-gray-500 mt-2">좋아하는 곡을 추가해보세요!</p>
                    </div>
                </div>
            </div>
        </div>
    </main>
</template>

<script>
import { mapState, mapActions } from 'vuex'

export default {
    layout: 'main',
    data() {
        return {
            loading: true,
            error: null
        }
    },
    computed: {
        ...mapState('player', ['currentTrack']),
        ...mapState('playlist', ['currentPlaylist']),
        estimatedDuration() {
            if (!this.currentPlaylist || !this.currentPlaylist.songs) return '';
            const totalSongs = this.currentPlaylist.songs.length;
            const estimatedMinutes = totalSongs * 3; // 평균 3분으로 가정
            const hours = Math.floor(estimatedMinutes / 60);
            const minutes = estimatedMinutes % 60;
            return hours > 0
                ? `• 약 ${hours}시간 ${minutes}분`
                : `• 약 ${minutes}분`;
        }
    },
    methods: {
        ...mapActions('player', ['playEntirePlaylist', 'playShuffledPlaylist']),
        ...mapActions('playlist', ['fetchPlaylistDetail', 'updatePlaylist', 'removeSongsFromPlaylist']),
        async playAll() {
            if (this.currentPlaylist.songs.length) {
                await this.playEntirePlaylist(this.currentPlaylist)
            }
        },
        async shufflePlay() {
            if (this.currentPlaylist.songs.length) {
                await this.playShuffledPlaylist(this.currentPlaylist)
            }
        },
        async removeSong(song) {
            try {
                const result = await this.removeSongsFromPlaylist({ 
                    playlistId: this.currentPlaylist._id, 
                    songIds: [song.songId] 
                })
                if (result.success) {
                    this.$toast.success(`${result.removedCount}곡이 플레이리스트에서 제거되었습니다.`)
                    await this.fetchPlaylistDetail(this.currentPlaylist._id)
                }
            } catch (error) {
                this.$toast.error('곡 제거 중 오류가 발생했습니다.')
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
    },
    beforeRouteEnter(to, from, next) {
        next(vm => {
            vm.fetchPlaylistDetail(to.params.id)
        })
    }
}
</script>

<style scoped>
.container-fluid {
    width: 100%;
    max-width: none;
}

.custom-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: #4a5568 #2d3748;
}

.custom-scrollbar::-webkit-scrollbar {
    width: 8px;
}

.custom-scrollbar::-webkit-scrollbar-track {
    background: #2d3748;
    border-radius: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: #4a5568;
    border-radius: 4px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: #718096;
}

@media (min-width: 640px) {
    .custom-scrollbar {
        height: calc(100vh - 500px) !important;
    }
}
</style>