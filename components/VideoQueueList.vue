<template>
    <div class="bg-gray-800 bg-opacity-70 rounded-lg shadow-lg p-4 sm:p-6">
        <div class="flex items-center space-x-4 pb-3 mb-3 border-b border-gray-700">
            <button @click="toggleSelectAll" class="text-gray-400 hover:text-white transition-colors duration-200">
                <i :class="['fas', allSelected ? 'fa-check-square' : 'fa-square']"></i>
            </button>
            <button @click="removeSelected" :disabled="selectedVideos.length === 0"
                class="text-gray-400 hover:text-red-500 transition-colors duration-200 disabled:opacity-50">
                <i class="fas fa-trash"></i>
            </button>
        </div>

        <div v-if="queue.length === 0" class="text-center py-12 text-gray-400">
            재생목록이 비어 있습니다. 검색 결과의 + 버튼으로 추가해보세요.
        </div>
        <draggable v-else v-model="localQueue" class="space-y-3" handle=".drag-handle" @end="onDragEnd" :animation="200"
            :delay="0" :delayOnTouchOnly="true" :touchStartThreshold="2" :scroll="true" :scrollSensitivity="50"
            :forceFallback="true" :fallbackTolerance="5" ghost-class="ghost-item" chosen-class="chosen-item"
            drag-class="drag-item">
            <transition-group name="list">
                <li v-for="video in localQueue" :key="video.id" :class="[
                    'flex items-center p-3 mb-2 rounded-lg transition-all duration-300 ease-in-out',
                    video.id === currentVideo?.id
                        ? 'bg-purple-700 bg-opacity-50 hover:bg-opacity-70 shadow-lg border-l-4 border-purple-500'
                        : 'bg-gray-700 bg-opacity-50 hover:bg-opacity-70'
                ]">
                    <div class="flex items-center justify-center w-6 h-6 mr-2">
                        <input type="checkbox" :checked="isVideoSelected(video)" @change="toggleVideoSelection(video)"
                            class="form-checkbox h-3 w-3 text-purple-600">
                    </div>

                    <div class="flex-grow flex items-center min-w-0 cursor-pointer group" @click="playVideo(video)">
                        <div class="relative w-20 h-12 mr-4 flex-shrink-0">
                            <img :src="video.thumbnail" :alt="video.title" class="w-full h-full object-cover rounded-lg shadow-md">
                            <div class="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                <i class="fas fa-play text-white"></i>
                            </div>
                        </div>
                        <div class="flex-grow min-w-0">
                            <p :class="['font-medium truncate transition-colors duration-200',
                                video.id === currentVideo?.id ? 'text-purple-300' : 'text-white group-hover:text-purple-300']">
                                {{ video.title }}
                            </p>
                            <p class="text-sm text-gray-300 truncate">{{ video.channelTitle }}</p>
                        </div>
                    </div>

                    <div class="drag-handle cursor-move touch-manipulation flex items-center justify-center px-2 py-4 -my-3 -mr-2 active:bg-gray-600 active:bg-opacity-30 rounded-lg">
                        <div class="grid grid-cols-2 gap-1">
                            <div class="w-1 h-1 rounded-full bg-gray-400"></div>
                            <div class="w-1 h-1 rounded-full bg-gray-400"></div>
                            <div class="w-1 h-1 rounded-full bg-gray-400"></div>
                            <div class="w-1 h-1 rounded-full bg-gray-400"></div>
                            <div class="w-1 h-1 rounded-full bg-gray-400"></div>
                            <div class="w-1 h-1 rounded-full bg-gray-400"></div>
                        </div>
                    </div>
                </li>
            </transition-group>
        </draggable>
    </div>
</template>

<script>
import { mapState, mapActions, mapMutations } from 'vuex'
import draggable from 'vuedraggable'

export default {
    name: 'VideoQueueList',
    components: { draggable },
    data() {
        return {
            selectedVideos: [],
        }
    },
    computed: {
        ...mapState('videoQueue', ['queue', 'currentVideo']),
        localQueue: {
            get() {
                return this.queue
            },
            set(value) {
                this.SET_QUEUE(value)
            }
        },
        allSelected() {
            return this.queue.length > 0 && this.selectedVideos.length === this.queue.length
        }
    },
    methods: {
        ...mapActions('videoQueue', ['setCurrentVideo', 'removeFromQueue']),
        ...mapMutations('videoQueue', ['SET_QUEUE']),
        onDragEnd() {
            this.SET_QUEUE(this.localQueue)
        },
        toggleVideoSelection(video) {
            const index = this.selectedVideos.findIndex(v => v.id === video.id)
            if (index === -1) {
                this.selectedVideos.push(video)
            } else {
                this.selectedVideos.splice(index, 1)
            }
        },
        isVideoSelected(video) {
            return this.selectedVideos.some(v => v.id === video.id)
        },
        toggleSelectAll() {
            this.selectedVideos = this.allSelected ? [] : [...this.queue]
        },
        removeSelected() {
            const videoIds = this.selectedVideos.map(video => video.id)
            this.removeFromQueue(videoIds)
            this.selectedVideos = []
        },
        playVideo(video) {
            this.setCurrentVideo(video)
        },
    }
}
</script>

<style scoped>
.list-move {
    transition: transform 0.5s ease;
}

.list-enter-active,
.list-leave-active {
    transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.list-enter-from,
.list-leave-to {
    opacity: 0;
    transform: translateX(30px);
}

.ghost-item {
    opacity: 0.6;
    background-color: #1a202c !important;
    border: 2px solid #4a5568 !important;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2) !important;
    transform: scale(1.02) !important;
}

.chosen-item {
    z-index: 10;
}

.drag-item {
    opacity: 0.9;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);
    cursor: grabbing;
    background-color: rgba(76, 29, 149, 0.3) !important;
}

.drag-handle {
    touch-action: none;
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
}

.drag-handle:active {
    background-color: rgba(107, 114, 128, 0.3);
    border-radius: 8px;
}
</style>
