<template>
    <div class="bg-gray-800 bg-opacity-70 rounded-lg shadow-lg p-4 sm:p-6 transition-transform duration-300">
        <div v-if="loading" class="flex justify-center items-center py-12">
            <i class="fas fa-spinner fa-spin text-2xl text-gray-300"></i>
        </div>

        <div v-else-if="!currentPlaylist" class="flex flex-col items-center justify-center py-12">
            <div class="text-lg text-gray-300 mb-4">플레이리스트를 찾을 수 없습니다.</div>
            <button @click="$emit('back')" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded">
                보관함으로
            </button>
        </div>

        <div v-else>
            <button @click="$emit('back')" class="mb-4 text-gray-400 hover:text-white">
                <i class="fas fa-arrow-left mr-2"></i>보관함으로
            </button>

            <div class="flex items-center mb-4">
                <div class="w-24 h-24 sm:w-32 sm:h-32 rounded-lg overflow-hidden mr-4 shrink-0 bg-gray-700 flex items-center justify-center">
                    <img v-if="currentPlaylist.videos[0]" :src="currentPlaylist.videos[0].thumbnail" :alt="currentPlaylist.videos[0].title"
                        class="w-full h-full object-cover">
                    <i v-else class="fas fa-video text-3xl text-gray-500"></i>
                </div>

                <div class="flex-1 min-w-0">
                    <div class="flex items-center min-h-[40px] sm:min-h-[48px]">
                        <h1 v-if="!isEditing" @click="startEditing"
                            class="text-xl sm:text-2xl md:text-3xl font-bold hover:text-gray-300 cursor-pointer flex items-center truncate">
                            {{ currentPlaylist.name }}
                            <i class="fas fa-pen text-xs sm:text-sm ml-2 text-gray-400 shrink-0"></i>
                        </h1>
                        <div v-else class="flex items-center gap-2 w-full sm:w-auto">
                            <input ref="nameInput" v-model="editingName" @keyup.enter="saveName" @keyup.esc="cancelEditing"
                                class="text-xl sm:text-2xl md:text-3xl font-bold bg-gray-700 text-white rounded px-3 py-1.5 sm:py-1 w-[calc(100%-100px)] sm:w-auto sm:min-w-[300px] sm:max-w-[500px] focus:outline-none focus:ring-2 focus:ring-purple-500" />
                            <div class="flex gap-2 sm:gap-1 shrink-0">
                                <button @click="saveName" class="text-green-500 hover:text-green-400 p-2.5 sm:p-2 rounded-full hover:bg-gray-700" title="저장">
                                    <i class="fas fa-check text-lg sm:text-base"></i>
                                </button>
                                <button @click="cancelEditing" class="text-gray-500 hover:text-gray-400 p-2.5 sm:p-2 rounded-full hover:bg-gray-700" title="취소">
                                    <i class="fas fa-times text-lg sm:text-base"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                    <p class="text-sm sm:text-base text-gray-400">{{ currentPlaylist.videos.length }}개 영상</p>
                </div>
            </div>

            <button @click="playAll" :disabled="!currentPlaylist.videos.length"
                class="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-3 rounded text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed mb-4">
                전체 재생
            </button>

            <ul v-if="currentPlaylist.videos.length" class="space-y-3">
                <li v-for="(video, index) in currentPlaylist.videos" :key="video.videoId"
                    class="flex items-center p-2 rounded-lg hover:bg-gray-700 transition-colors duration-200">
                    <span class="mr-2 text-lg font-bold text-purple-400 w-6">{{ index + 1 }}</span>
                    <img :src="video.thumbnail" :alt="video.title" class="w-16 h-10 object-cover rounded-lg mr-2 shadow-md" />
                    <div class="flex-grow min-w-0 mr-2">
                        <p class="font-medium text-sm sm:text-base truncate">{{ video.title }}</p>
                        <p class="text-xs sm:text-sm text-gray-300 truncate">{{ video.channelTitle }}</p>
                    </div>
                    <button @click="removeVideo(video)" class="text-red-500 hover:text-red-600 flex-shrink-0">
                        <i class="fas fa-trash"></i>
                    </button>
                </li>
            </ul>
            <div v-else class="text-center py-8">
                <p class="text-xl text-gray-400">이 플레이리스트에는 아직 영상이 없습니다.</p>
            </div>
        </div>
    </div>
</template>

<script>
import { mapState, mapActions } from 'vuex'

export default {
    name: 'VideoPlaylistDetailPanel',
    props: {
        playlistId: {
            type: String,
            required: true
        }
    },
    data() {
        return {
            loading: true,
            isEditing: false,
            editingName: '',
        }
    },
    computed: {
        ...mapState('videoPlaylist', ['currentPlaylist']),
    },
    methods: {
        ...mapActions('videoPlaylist', ['fetchPlaylistDetail', 'updatePlaylistName', 'removeVideosFromPlaylist']),
        ...mapActions('videoQueue', ['setQueueAndPlay']),
        async load() {
            this.loading = true
            try {
                await this.fetchPlaylistDetail(this.playlistId)
            } catch (error) {
                console.error('비디오 플레이리스트 조회 실패:', error)
            } finally {
                this.loading = false
            }
        },
        playAll() {
            if (!this.currentPlaylist.videos.length) return
            const videos = this.currentPlaylist.videos.map(v => ({
                id: v.videoId,
                title: v.title,
                thumbnail: v.thumbnail,
                channelTitle: v.channelTitle,
                duration: v.duration,
            }))
            this.setQueueAndPlay(videos)
            this.$emit('play-all')
        },
        async removeVideo(video) {
            try {
                const result = await this.removeVideosFromPlaylist({
                    playlistId: this.currentPlaylist._id,
                    videoIds: [video.videoId]
                })
                if (result && result.success) {
                    this.$toast.success(`${result.removedCount}개 영상이 플레이리스트에서 제거되었습니다.`)
                    await this.fetchPlaylistDetail(this.currentPlaylist._id)
                }
            } catch (error) {
                this.$toast.error('영상 제거 중 오류가 발생했습니다.')
            }
        },
        startEditing() {
            this.editingName = this.currentPlaylist.name
            this.isEditing = true
            this.$nextTick(() => {
                this.$refs.nameInput.focus()
                this.$refs.nameInput.select()
            })
        },
        cancelEditing() {
            this.isEditing = false
            this.editingName = ''
        },
        async saveName() {
            if (!this.editingName.trim() || this.editingName.trim() === this.currentPlaylist.name) {
                this.cancelEditing()
                return
            }
            try {
                const result = await this.updatePlaylistName({
                    playlistId: this.currentPlaylist._id,
                    name: this.editingName.trim()
                })
                if (result.success) {
                    this.$toast.success('플레이리스트 이름이 변경되었습니다.')
                } else {
                    this.$toast.error('플레이리스트 이름 변경에 실패했습니다.')
                }
            } catch (error) {
                this.$toast.error('이름 변경 중 오류가 발생했습니다.')
            } finally {
                this.cancelEditing()
            }
        }
    },
    mounted() {
        this.load()
    },
    watch: {
        playlistId() {
            this.load()
        }
    }
}
</script>
