<template>
    <transition name="fade">
        <div v-if="show" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center" @click.self="close">
            <div class="bg-gray-800 rounded-lg p-6 max-w-sm w-full relative">
                <button @click="close" class="absolute top-2 right-2 text-gray-400 hover:text-white">
                    <i class="fas fa-times"></i>
                </button>
                <h3 class="text-xl font-semibold mb-4">추가하기</h3>
                <ul class="space-y-2">
                    <li v-if="isInQueue" class="p-2 text-sm text-gray-500">
                        이미 재생목록에 있습니다
                    </li>
                    <li v-else>
                        <button @click="addToQueueAndClose"
                            class="w-full text-left p-2 rounded hover:bg-gray-700 transition-colors duration-200">
                            재생목록에 추가
                        </button>
                    </li>
                    <li>
                        <button @click="showMyPlaylists = !showMyPlaylists"
                            class="w-full text-left p-2 rounded hover:bg-gray-700 transition-colors duration-200 flex justify-between items-center">
                            <span>플레이리스트에 추가</span>
                            <span class="transform transition-transform duration-200" :class="{ 'rotate-180': showMyPlaylists }">▼</span>
                        </button>
                        <transition name="fade">
                            <ul v-if="showMyPlaylists" class="mt-2 ml-4 space-y-2">
                                <li v-for="playlist in playlists" :key="playlist._id">
                                    <div v-if="isInPlaylist(playlist)" class="p-2 text-sm text-gray-500 flex justify-between items-center">
                                        <span>{{ playlist.name }}</span>
                                        <span class="text-xs">추가됨</span>
                                    </div>
                                    <button v-else @click="addToPlaylistAndClose(playlist)"
                                        class="w-full text-left p-2 rounded hover:bg-gray-700 transition-colors duration-200">
                                        {{ playlist.name }}
                                    </button>
                                </li>
                                <li v-if="playlists.length === 0" class="text-gray-400 text-sm p-2">
                                    저장된 플레이리스트가 없습니다. 보관함 탭에서 먼저 만들어주세요.
                                </li>
                            </ul>
                        </transition>
                    </li>
                </ul>
            </div>
        </div>
    </transition>
</template>

<script>
import { mapState, mapActions } from 'vuex'

export default {
    name: 'VideoAddModal',
    props: {
        show: Boolean,
        video: {
            type: Object,
            default: null
        }
    },
    data() {
        return {
            showMyPlaylists: false,
        }
    },
    computed: {
        ...mapState('videoPlaylist', ['playlists']),
        ...mapState('videoQueue', ['queue']),
        isInQueue() {
            return !!this.video && this.queue.some(v => v.id === this.video.id)
        },
    },
    watch: {
        show(newVal) {
            if (!newVal) this.showMyPlaylists = false
        }
    },
    methods: {
        ...mapActions('videoQueue', ['addToQueue']),
        ...mapActions('videoPlaylist', ['addVideosToPlaylist']),
        isInPlaylist(playlist) {
            return !!this.video && playlist.videos.some(v => v.videoId === this.video.id)
        },
        close() {
            this.$emit('close')
        },
        async addToQueueAndClose() {
            if (!this.video) return
            const result = await this.addToQueue(this.video)
            if (result.message === 'SUCCESS') {
                this.$toast.success('재생목록에 추가되었습니다.')
            } else if (result.message === 'ALL_DUPLICATES') {
                this.$toast.info('이미 재생목록에 있는 영상입니다.')
            }
            this.close()
        },
        async addToPlaylistAndClose(playlist) {
            if (!this.video) return
            try {
                const result = await this.addVideosToPlaylist({ playlistId: playlist._id, videos: [this.video] })
                if (result && result.success) {
                    if (result.addedVideos > 0) {
                        this.$toast.success(`"${playlist.name}" 플레이리스트에 추가되었습니다.`)
                    } else {
                        this.$toast.info('이미 추가되어 있습니다.')
                    }
                }
            } catch (error) {
                this.$toast.error('플레이리스트에 추가하는 데 실패했습니다.')
            }
            this.close()
        },
    }
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s;
}

.fade-enter,
.fade-leave-to {
    opacity: 0;
}
</style>
