<!-- components/AppFooter.vue -->
<template>
    <footer class="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-purple-900 to-indigo-900 text-white p-4 shadow-lg">
        <div class="max-w-screen-xl mx-auto">
            <!-- Progress bar -->
            <div class="w-full bg-gray-200 rounded-full h-1.5 mb-4 dark:bg-gray-700">
                <div class="bg-blue-600 h-1.5 rounded-full dark:bg-blue-500"
                    :style="{ width: `${(currentTime / duration) * 100}%` }"></div>
            </div>

            <div class="flex flex-col sm:flex-row justify-between items-center">
                <!-- Track info -->
                <div class="flex items-center mb-4 sm:mb-0">
                    <img :src="currentTrack?.imageUrl || 'https://via.placeholder.com/50'" alt="Album art"
                        class="w-12 h-12 rounded-md mr-4">
                    <div class="text-left">
                        <p class="font-semibold text-sm sm:text-base">{{ currentTrack?.name || 'No track playing' }}</p>
                        <p class="text-xs sm:text-sm text-gray-300">{{ currentTrack?.artist || '' }}</p>
                    </div>
                </div>

                <!-- Playback controls -->
                <div class="flex items-center space-x-4 mb-4 sm:mb-0">
                    <button @click="previousTrack" class="focus:outline-none hover:text-blue-400 transition-colors">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7">
                            </path>
                        </svg>
                    </button>
                    <button @click="togglePlay"
                        class="w-12 h-12 rounded-full bg-white text-purple-900 flex items-center justify-center focus:outline-none hover:bg-gray-200 transition-colors">
                        <svg v-if="isPlaying" class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <svg v-else class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z">
                            </path>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                    </button>
                    <button @click="nextTrack" class="focus:outline-none hover:text-blue-400 transition-colors">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                        </svg>
                    </button>
                </div>

                <!-- Additional controls -->
                <div class="flex items-center space-x-4">
                    <button @click="toggleRepeat" :class="{ 'text-blue-400': isRepeat }"
                        class="focus:outline-none hover:text-blue-400 transition-colors">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15">
                            </path>
                        </svg>
                    </button>
                    <button @click="toggleShuffle" :class="{ 'text-blue-400': isShuffle }"
                        class="focus:outline-none hover:text-blue-400 transition-colors">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z">
                            </path>
                        </svg>
                    </button>
                    <div class="relative">
                        <button @click="showVolume = !showVolume"
                            class="focus:outline-none hover:text-blue-400 transition-colors">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                xmlns="http://www.w3.org/2000/svg">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                    d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z">
                                </path>
                            </svg>
                        </button>
                        <input v-if="showVolume" type="range" min="0" max="1" step="0.01" :value="volume"
                            @input="updateVolume"
                            class="absolute bottom-full left-1/2 transform -translate-x-1/2 w-24 mb-2">
                    </div>
                    <button @click="showQueue = !showQueue"
                        class="focus:outline-none hover:text-blue-400 transition-colors">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                            xmlns="http://www.w3.org/2000/svg">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M4 6h16M4 10h16M4 14h16M4 18h16"></path>
                        </svg>
                    </button>
                </div>
            </div>
        </div>

        <!-- Queue overlay -->
        <div v-if="showQueue"
            class="absolute bottom-full left-0 right-0 bg-gray-900 bg-opacity-95 text-white p-4 max-h-96 overflow-y-auto">
            <h3 class="text-lg font-semibold mb-2">재생 목록</h3>
            <ul>
                <li v-for="(track, index) in queue" :key="index"
                    class="flex justify-between items-center py-2 hover:bg-gray-800 rounded px-2">
                    <span>{{ track.name }} - {{ track.artist }}</span>
                    <button @click="playTrack(track)" class="text-blue-400 hover:text-blue-300">재생</button>
                </li>
            </ul>
        </div>
    </footer>
</template>

<script>
import { mapState, mapGetters, mapActions } from 'vuex'

export default {
    name: 'AppFooter',
    data() {
        return {
            showVolume: false,
            showQueue: false
        }
    },
    computed: {
        ...mapState(['queue']),
        ...mapGetters([
            'getCurrentTrack',
            'getIsPlaying',
            'getVolume',
            'getCurrentTime',
            'getDuration',
            'getIsRepeat',
            'getIsShuffle'
        ]),
        currentTrack() {
            return this.getCurrentTrack
        },
        isPlaying() {
            return this.getIsPlaying
        },
        volume() {
            return this.getVolume
        },
        currentTime() {
            return this.getCurrentTime
        },
        duration() {
            return this.getDuration
        },
        isRepeat() {
            return this.getIsRepeat
        },
        isShuffle() {
            return this.getIsShuffle
        }
    },
    methods: {
        ...mapActions([
            'playTrack',
            'pauseTrack',
            'nextTrack',
            'previousTrack',
            'updateVolume',
            'updateCurrentTime',
            'toggleRepeat',
            'toggleShuffle'
        ]),
        togglePlay() {
            if (this.isPlaying) {
                this.pauseTrack()
            } else if (this.currentTrack) {
                this.playTrack(this.currentTrack)
            }
        }
    }
}
</script>