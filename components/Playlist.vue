<template>
    <transition name="slide-up">
        <div v-if="show" class="fixed inset-0 bg-black bg-opacity-50" @click="close">
            <div class="absolute inset-0 bg-gradient-to-b from-gray-900 to-gray-800 shadow-lg flex flex-col"
                @click.stop>
                <!-- Mobile Header -->
                <div class="p-4 bg-gray-800 sticky top-0 z-10 lg:hidden">
                    <div class="w-12 h-1 bg-gray-600 rounded-full mx-auto mb-4"></div>

                    <!-- Mobile Header Controls -->
                    <div class="flex justify-between items-center mb-4">
                        <h2 class="text-xl font-semibold text-purple-300">재생 목록 ({{ queue.length }}곡)</h2>
                        <button class="text-gray-400 hover:text-white transition-colors duration-200" @click="close">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>

                    <!-- Mobile Current Track Info -->
                    <div v-if="currentTrack" class="flex items-center">
                        <img :src="currentTrack.coverUrl" :alt="currentTrack.title"
                            class="w-12 h-12 rounded-lg mr-4 object-cover">
                        <div class="flex-grow min-w-0">
                            <h3 class="font-bold text-white truncate">{{ currentTrack.title }}</h3>
                            <p class="text-sm text-gray-300 truncate">{{ currentTrack.artist }}</p>
                        </div>
                        <button @click="toggleMobileLyrics" class="ml-4 p-2 rounded-lg transition-colors duration-200"
                            :class="showMobileLyrics
                                ? 'bg-purple-600 text-white'
                                : 'text-gray-400 hover:text-white'">
                            <i class="fas fa-align-left"></i>
                        </button>
                    </div>
                </div>

                <!-- Mobile Lyrics View -->
                <transition name="fade" mode="out-in">
                    <div v-if="showMobileLyrics && currentTrack" ref="mobileLyricsContainer"
                        class="flex-grow lg:hidden bg-gray-900 overflow-y-auto custom-scrollbar">
                        <div class="p-6 mb-24">
                            <div class="bg-gray-800 bg-opacity-50 rounded-lg p-6">
                                <div class="text-base lg:text-lg leading-relaxed text-white"
                                    style="white-space: pre-line; word-break: keep-all;">
                                    {{ currentTrack.lyrics || '가사 정보가 없습니다.' }}
                                </div>
                            </div>
                        </div>
                    </div>
                </transition>

                <!-- Desktop Split View -->
                <div v-show="!showMobileLyrics || !currentTrack" class="flex-grow flex flex-col lg:flex-row">
                    <!-- Cover Art Section (Desktop Only) -->
                    <div class="hidden lg:flex lg:w-4/5 flex-col bg-gray-900">
                        <!-- Desktop Navigation -->
                        <div class="w-full flex justify-end p-4 border-b border-gray-800">
                            <div class="flex space-x-4">
                                <button @click="view = 'cover'" :class="['px-4 py-2 rounded-lg transition-colors duration-200',
                                    view === 'cover'
                                        ? 'bg-purple-600 text-white'
                                        : 'text-gray-400 hover:text-white']">
                                    <i class="fas fa-image mr-2"></i>앨범아트
                                </button>
                                <button @click="view = 'lyrics'" :class="['px-4 py-2 rounded-lg transition-colors duration-200',
                                    view === 'lyrics'
                                        ? 'bg-purple-600 text-white'
                                        : 'text-gray-400 hover:text-white']">
                                    <i class="fas fa-align-left mr-2"></i>가사
                                </button>
                            </div>
                        </div>

                        <!-- Desktop Content Area -->
                        <div class="flex-grow relative">
                            <transition name="fade" mode="out-in">
                                <!-- Cover Art View -->
                                <div v-if="view === 'cover'" key="cover"
                                    class="absolute inset-0 flex items-center justify-center pb-24 px-16">
                                    <div v-if="currentTrack || queue.length > 0"
                                        class="relative w-full max-w-2xl aspect-square rounded-lg overflow-hidden shadow-2xl">
                                        <img :src="currentTrack?.coverUrl.replace('/50/', '/700/') || queue[0]?.coverUrl.replace('/50/', '/700/')"
                                            :alt="currentTrack?.title || queue[0]?.title"
                                            class="w-full h-full object-cover">
                                        <div
                                            class="absolute inset-0 bg-gradient-to-b from-transparent to-black opacity-30">
                                        </div>
                                    </div>
                                    <div v-else class="text-center">
                                        <div
                                            class="w-64 h-64 bg-gray-800 rounded-lg flex items-center justify-center mb-6">
                                            <i class="fas fa-music text-6xl text-gray-600"></i>
                                        </div>
                                        <p class="text-gray-400 text-lg">재생목록에 곡이 없습니다</p>
                                    </div>
                                </div>

                                <!-- Lyrics View -->
                                <div v-else key="lyrics" ref="lyricsContainer"
                                    class="absolute inset-0 flex items-start justify-center pt-8 pb-16 overflow-y-auto custom-scrollbar">
                                    <div v-if="currentTrack" class="w-full max-w-3xl">
                                        <div class="bg-gray-800 bg-opacity-50 rounded-lg">
                                            <div class="text-base lg:text-lg leading-relaxed text-white p-8"
                                                ref="lyricsContent"
                                                style="white-space: pre-line; word-break: keep-all;">
                                                {{ currentTrack?.lyrics || '가사 정보가 없습니다.' }}
                                            </div>
                                        </div>
                                    </div>
                                    <div v-else class="text-center">
                                        <div
                                            class="w-64 h-64 bg-gray-800 rounded-lg flex items-center justify-center mb-6">
                                            <i class="fas fa-align-left text-6xl text-gray-600"></i>
                                        </div>
                                        <p class="text-gray-400 text-lg">재생 중인 곡이 없습니다</p>
                                    </div>
                                </div>
                            </transition>
                        </div>
                    </div>

                    <!-- Playlist Section -->
                    <div class="flex-grow lg:w-1/5 flex flex-col bg-gray-800 lg:border-l border-gray-700">
                        <!-- Playlist Controls -->
                        <div class="p-4 bg-gray-800 sticky top-0 z-10 border-b border-gray-700">
                            <div class="flex justify-between items-center">
                                <div class="flex items-center space-x-4">
                                    <button @click="toggleSelectAll"
                                        class="text-gray-400 hover:text-white transition-colors duration-200">
                                        <i :class="['fas', allSelected ? 'fa-check-square' : 'fa-square']"></i>
                                    </button>
                                    <button @click="removeSelected" :disabled="selectedSongs.length === 0"
                                        class="text-gray-400 hover:text-red-500 transition-colors duration-200 disabled:opacity-50">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                                <span class="text-purple-300">{{ queue.length }}곡</span>
                            </div>
                        </div>

                        <!-- Playlist Items -->
                        <div ref="queueContainer" class="flex-grow overflow-y-auto custom-scrollbar">
                            <draggable v-model="localQueue" class="p-4 space-y-3" handle=".drag-handle" @end="onDragEnd"
                                :animation="200" :delay="100" :delayOnTouchOnly="true" :touchStartThreshold="5"
                                :scroll="true" :scrollSensitivity="30" :forceFallback="true" ghost-class="ghost-item"
                                chosen-class="chosen-item" drag-class="drag-item">
                                <transition-group name="list">
                                    <li v-for="(song) in localQueue" :key="song._id"
                                        :ref="song._id === currentTrack?._id ? 'currentTrack' : null" :class="[
                                            'flex items-center p-3 mb-2 rounded-lg transition-all duration-300 ease-in-out relative',
                                            song._id === currentTrack?._id
                                                ? 'bg-purple-700 bg-opacity-50 hover:bg-opacity-70 shadow-lg transform scale-102 border-l-4 border-purple-500'
                                                : 'bg-gray-700 bg-opacity-50 hover:bg-opacity-70'
                                        ]">
                                        <div class="flex items-center justify-center w-6 h-6 mr-2">
                                            <input type="checkbox" :checked="isSongSelected(song)"
                                                @change="toggleSongSelection(song)"
                                                class="form-checkbox h-3 w-3 text-purple-600">
                                        </div>

                                        <div class="flex-grow flex items-center min-w-0 cursor-pointer group"
                                            @click="playSong(song)">
                                            <div class="relative w-12 h-12 mr-4 flex-shrink-0">
                                                <img :src="song.coverUrl" :alt="song.title"
                                                    class="w-full h-full object-cover rounded-lg shadow-md">
                                                <div class="absolute inset-0 bg-black bg-opacity-50 rounded-lg 
                                                    flex items-center justify-center opacity-0 
                                                    group-hover:opacity-100 transition-opacity duration-200">
                                                    <i class="fas fa-play text-white text-lg"></i>
                                                </div>
                                            </div>
                                            <div class="flex-grow min-w-0">
                                                <p :class="['font-medium truncate transition-all duration-300 ease-in-out',
                                                    song._id === currentTrack?._id
                                                        ? 'text-purple-300'
                                                        : 'text-white group-hover:text-purple-300']">
                                                    {{ song.title }}
                                                </p>
                                                <p class="text-sm text-gray-300 truncate">{{ song.artist }}</p>
                                            </div>
                                        </div>

                                        <div v-if="song._id === currentTrack?._id"
                                            class="text-purple-400 mr-2 animate-pulse">
                                            <i class="fas fa-volume-up"></i>
                                        </div>

                                        <div class="drag-handle cursor-move touch-manipulation
                                            flex items-center justify-center px-2 py-4 -my-3 -mr-2">
                                            <div class="flex flex-col items-center space-y-1">
                                                <div class="w-1 h-1 rounded-full bg-gray-400"></div>
                                                <div class="w-1 h-1 rounded-full bg-gray-400"></div>
                                                <div class="w-1 h-1 rounded-full bg-gray-400"></div>
                                            </div>
                                        </div>
                                    </li>
                                </transition-group>
                            </draggable>
                        </div>
                    </div>
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
            selectedSongs: [],
            view: 'cover',
            showMobileLyrics: false
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
            this.SET_QUEUE(this.localQueue)
        },
        toggleMobileLyrics() {
            this.showMobileLyrics = !this.showMobileLyrics
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
                currentTrackElement[0].scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
        }
    }
}
</script>

<style scoped>
/* Transitions */
.slide-up-enter-active,
.slide-up-leave-active {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
    transform: translateY(100%);
    opacity: 0;
}

/* List Transitions */
.list-move {
    transition: transform 0.5s ease;
}

.list-enter-active,
.list-leave-active {
    transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.list-enter-from {
    opacity: 0;
    transform: translateX(30px);
}

.list-leave-to {
    opacity: 0;
    transform: translateX(30px);
}

/* Drag and Drop Styles */
.ghost-item {
    opacity: 0.6;
    background-color: #1a202c !important;
    border: 2px solid #4a5568 !important;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2) !important;
    transform: scale(1.02) !important;
}

.ghost-item.bg-purple-700 {
    border-left: 4px solid #9f7aea !important;
}

.chosen-item {
    z-index: 10;
}

.drag-item {
    opacity: 0.9;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    cursor: grabbing;
}

/* Touch Optimizations */
.drag-handle {
    touch-action: none;
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    user-select: none;
}

/* Scrollbar Styles */
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

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: rgba(155, 155, 155, 0.7);
}

/* Hover Effects */
.group:hover .text-white {
    color: theme('colors.purple.300');
}

/* Animations */
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

/* Transform */
.scale-102 {
    transform: scale(1.02);
}

/* Mobile Responsive */
@media (max-width: 1024px) {
    .lg\:w-4\/5 {
        width: 100%;
    }

    .lg\:w-1\/5 {
        width: 100%;
    }

    .lg\:flex-row {
        flex-direction: column;
    }
}
</style>