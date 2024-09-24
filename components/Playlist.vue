<template>
    <transition name="slide-up">
        <div v-if="show" class="fixed inset-0 bg-black bg-opacity-50" @click="close">
            <div class="absolute inset-x-0 bottom-0 bg-gradient-to-b from-gray-900 to-gray-800 shadow-lg rounded-t-xl max-h-[80vh] overflow-hidden flex flex-col"
                @click.stop>
                <div class="p-4 bg-gray-800 sticky top-0 z-10">
                    <div class="w-12 h-1 bg-gray-600 rounded-full mx-auto mb-4"></div>
                    <div class="flex justify-between items-center mb-4">
                        <h2 class="text-xl font-semibold text-purple-300">재생 목록 ({{ queue.length }}곡)</h2>
                        <div class="flex space-x-2">
                            <button @click="toggleSelectAll"
                                class="text-gray-400 hover:text-white transition-colors duration-200">
                                <i :class="['fas', allSelected ? 'fa-check-square' : 'fa-square']"></i>
                            </button>
                            <button @click="removeSelected" :disabled="selectedSongs.length === 0"
                                class="text-gray-400 hover:text-red-500 transition-colors duration-200 disabled:opacity-50">
                                <i class="fas fa-trash"></i>
                            </button>
                            <button class="text-gray-400 hover:text-white transition-colors duration-200"
                                @click="close">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    </div>
                </div>
                <div ref="queueContainer" class="flex-grow overflow-y-auto custom-scrollbar pb-20">
                    <draggable v-model="localQueue" class="p-4 space-y-3" handle=".drag-handle" @end="onDragEnd"
                        :animation="200" :delay="50" :delayOnTouchOnly="true" :touchStartThreshold="50">
                        <li v-for="(song) in localQueue" :key="song._id"
                            :ref="song._id === currentTrack?._id ? 'currentTrack' : null" :class="['flex items-center p-3 rounded-lg transition-all duration-300 ease-in-out',
                                song._id === currentTrack?._id
                                    ? 'bg-purple-700 bg-opacity-50 hover:bg-opacity-70 shadow-lg transform scale-102 border-l-4 border-purple-500'
                                    : 'bg-gray-700 bg-opacity-50 hover:bg-opacity-70']">
                            <div class="flex items-center justify-center w-6 h-6 mr-2">
                                <input type="checkbox" :checked="isSongSelected(song)"
                                    @change="toggleSongSelection(song)" class="form-checkbox h-3 w-3 text-purple-600">
                            </div>
                            <div class="flex-grow flex items-center min-w-0 cursor-pointer group"
                                @click="playSong(song)">
                                <div class="relative w-12 h-12 mr-4 flex-shrink-0">
                                    <img :src="song.coverUrl" :alt="song.title"
                                        class="w-full h-full object-cover rounded-lg shadow-md">
                                    <div
                                        class="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                        <i class="fas fa-play text-white text-lg"></i>
                                    </div>
                                </div>
                                <div class="flex-grow min-w-0">
                                    <p
                                        :class="['font-medium truncate transition-all duration-300 ease-in-out',
                                            song._id === currentTrack?._id ? 'text-purple-300' : 'text-white group-hover:text-purple-300']">
                                        {{ song.title }}
                                    </p>
                                    <p class="text-sm text-gray-300 truncate">{{ song.artist }}</p>
                                </div>
                            </div>
                            <div v-if="song._id === currentTrack?._id" class="text-purple-400 mr-2 animate-pulse">
                                <i class="fas fa-volume-up"></i>
                            </div>
                            <div class="drag-handle cursor-move text-gray-400 ml-2 touch-manipulation">
                                <i class="fas fa-grip-vertical"></i>
                            </div>
                        </li>
                    </draggable>
                </div>
            </div>
        </div>
    </transition>
</template>

<script>
import { mapState, mapActions, mapMutations } from 'vuex'
import draggable from 'vuedraggable'

export default {
    name: 'PlaylistComponent',
    components: {
        draggable,
    },
    props: {
        show: {
            type: Boolean,
            required: true
        }
    },
    data() {
        return {
            selectedSongs: []
        }
    },
    computed: {
        ...mapState('player', ['queue', 'currentTrack']),
        localQueue: {
            get() {
                return this.queue
            },
            set(value) {
                this.SET_QUEUE(value)
            }
        },
        allSelected() {
            return this.queue.length > 0 && this.selectedSongs.length === this.queue.length
        }
    },
    watch: {
        show(newVal) {
            if (newVal) {
                this.$nextTick(() => {
                    this.scrollToCurrentTrack()
                })
            }
        },
        currentTrack() {
            this.$nextTick(() => {
                this.scrollToCurrentTrack()
            })
        }
    },
    methods: {
        ...mapActions('player', ['setCurrentTrack', 'play', 'removeFromQueue']),
        ...mapMutations('player', ['SET_QUEUE']),
        close() {
            this.$emit('close')
        },
        onDragEnd() {
            // 드래그 종료 시 큐 업데이트
            this.SET_QUEUE(this.localQueue)
        },
        toggleSongSelection(song) {
            const index = this.selectedSongs.findIndex(s => s._id === song._id)
            if (index === -1) {
                this.selectedSongs.push(song)
            } else {
                this.selectedSongs.splice(index, 1)
            }
        },
        isSongSelected(song) {
            return this.selectedSongs.some(s => s._id === song._id)
        },
        toggleSelectAll() {
            if (this.allSelected) {
                this.selectedSongs = []
            } else {
                this.selectedSongs = [...this.queue]
            }
        },
        async removeSelected() {
            const trackIdsToRemove = this.selectedSongs.map(song => song._id)
            await this.removeFromQueue(trackIdsToRemove)
            this.selectedSongs = []
        },
        async playSong(song) {
            await this.setCurrentTrack(song)
            this.play()
        },
        scrollToCurrentTrack() {
            const currentTrackElement = this.$refs.currentTrack
            if (currentTrackElement && currentTrackElement[0]) {
                currentTrackElement[0].scrollIntoView({ behavior: 'smooth', block: 'center' })
            }
        }
    },
    mounted() {
        this.$nextTick(() => {
            this.scrollToCurrentTrack()
        })
    }
}
</script>

<style scoped>
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

.touch-manipulation {
    touch-action: manipulation;
}

.group:hover .text-white {
    color: theme('colors.purple.300');
}

@keyframes pulse {

    0%,
    100% {
        opacity: 1;
    }

    50% {
        opacity: 0.5;
    }
}

.animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.scale-102 {
    transform: scale(1.02);
}
</style>