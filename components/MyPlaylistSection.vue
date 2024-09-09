<template>
    <div class="bg-gray-800 bg-opacity-70 rounded-lg shadow-lg p-4 sm:p-6 transition-transform duration-300">
        <div class="flex justify-between items-center mb-4 sm:mb-12">
            <h2 class="text-xl sm:text-2xl font-semibold text-blue-300">내 플레이리스트</h2>
            <div class="relative" ref="dropdownContainer">
                <button @click="toggleDropdown" class="text-gray-300 hover:text-white">
                    <i class="fas fa-ellipsis-h"></i>
                </button>
                <div v-if="showDropdown" class="absolute right-0 mt-2 w-48 bg-gray-700 rounded-md shadow-lg z-10">
                    <div class="py-1">
                        <a href="#" class="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-600"
                            @click.prevent="managePlaylists">플레이리스트 관리</a>
                        <a href="#" class="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-600"
                            @click.prevent="sortPlaylists">정렬 옵션</a>
                    </div>
                </div>
            </div>
        </div>
        <div class="h-[320px] overflow-y-auto pr-2 custom-scrollbar">
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
                <div @click="$emit('create-playlist')"
                    class="relative group cursor-pointer bg-gray-700 rounded-lg flex items-center justify-center aspect-square transition-colors duration-300 hover:bg-gray-600">
                    <i class="fas fa-plus text-4xl text-gray-400 group-hover:text-white transition-colors duration-300"></i>
                </div>
                <div v-for="playlist in playlists" :key="playlist._id" class="relative group cursor-pointer"
                    @touchstart="touchStart(playlist._id, $event)" @touchend="touchEnd(playlist._id, $event)"
                    @touchmove="touchMove(playlist._id, $event)">
                    <div v-if="playlist.songs.length === 0" class="aspect-square w-full flex flex-col items-center justify-center p-4">
                        <i class="fas fa-music text-4xl text-gray-400 mb-2"></i>
                        <p class="text-center text-sm text-gray-300">아직 곡이 없습니다</p>
                        <p class="text-center text-xs text-gray-400 mt-1">곡을 추가해보세요!</p>
                    </div>
                    <div v-else class="aspect-square w-full">
                        <div class="grid grid-cols-2 grid-rows-2 h-full transform transition-transform duration-300 group-hover:scale-105">
                            <img v-for="(song, index) in playlist.songs.slice(0, 4)" :key="index"
                            :src="song.coverUrl.replace('/50/', '/200/') || 'https://via.placeholder.com/100x100'"
                            :alt="`Cover for ${song.title}`"
                            class="w-full h-full object-cover"
                            />
                        </div>
                    </div>
                    <div :class="['absolute inset-0 bg-gradient-to-t from-black to-transparent transition-opacity duration-300 flex flex-col items-center justify-end p-2 sm:p-4',
                        { 'opacity-0 group-hover:opacity-100': !isMobile },
                        { 'opacity-100': isMobile && activeTouchPlaylist === playlist._id }]">
                        <p class="font-medium text-center text-sm sm:text-lg truncate mb-2">{{ playlist.name }}</p>
                        <button v-if="!isMobile && playlistToDelete !== playlist._id"
                            @click.stop="deletePlaylist(playlist._id)"
                            class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-full text-sm transition-colors duration-300">
                            삭제
                        </button>
                        <div v-if="!isMobile && playlistToDelete === playlist._id" class="flex space-x-2">
                            <button @click.stop="confirmDelete(playlist._id)"
                                class="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-full text-sm transition-colors duration-300">
                                확인
                            </button>
                            <button @click.stop="cancelDelete"
                                class="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded-full text-sm transition-colors duration-300">
                                취소
                            </button>
                        </div>
                    </div>
                    <transition name="slide-fade">
                        <div v-if="isMobile && swipedPlaylist === playlist._id"
                            class="absolute inset-y-0 right-0 flex items-center bg-gray-800 bg-opacity-90 px-2 py-1">
                            <button @click.stop="confirmDelete(playlist._id)"
                                class="bg-red-500 text-white text-xs px-2 py-1 rounded mr-1">
                                삭제
                            </button>
                            <button @click.stop="cancelDelete" class="bg-gray-500 text-white text-xs px-2 py-1 rounded">
                                취소
                            </button>
                        </div>
                    </transition>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    props: {
        playlists: {
            type: Array,
            required: true
        }
    },
    data() {
        return {
            showDropdown: false,
            touchStartX: 0,
            touchEndX: 0,
            swipeThreshold: 50,
            playlistToDelete: null,
            isMobile: false,
            activeTouchPlaylist: null,
            swipedPlaylist: null
        }
    },
    methods: {
        toggleDropdown() {
            this.showDropdown = !this.showDropdown
        },
        closeDropdown(event) {
            if (!this.$refs.dropdownContainer.contains(event.target)) {
                this.showDropdown = false
            }
        },
        deletePlaylist(playlistId) {
            this.playlistToDelete = playlistId
        },
        confirmDelete(playlistId) {
            this.$emit('delete-playlist', playlistId)
            this.playlistToDelete = null
            this.swipedPlaylist = null
        },
        cancelDelete() {
            this.playlistToDelete = null
            this.swipedPlaylist = null
        },
        managePlaylists() {
            console.log('플레이리스트 관리')
            this.showDropdown = false
        },
        sortPlaylists() {
            console.log('정렬 옵션')
            this.showDropdown = false
        },
        touchStart(playlistId, event) {
            this.touchStartX = event.touches[0].clientX
            this.activeTouchPlaylist = playlistId
        },
        touchEnd(playlistId, event) {
            this.touchEndX = event.changedTouches[0].clientX
            if (this.touchStartX - this.touchEndX > this.swipeThreshold) {
                this.swipedPlaylist = playlistId
            } else {
                setTimeout(() => {
                    this.activeTouchPlaylist = null
                }, 300)
            }
        },
        touchMove(playlistId, event) {
            if (Math.abs(event.touches[0].clientX - this.touchStartX) > 10) {
                this.activeTouchPlaylist = null
            }
            if (this.touchStartX - event.touches[0].clientX > this.swipeThreshold) {
                event.preventDefault() // Prevent scrolling while swiping
            }
        },
        checkMobile() {
            this.isMobile = window.innerWidth < 640 // sm breakpoint
        }
    },
    mounted() {
        document.addEventListener('click', this.closeDropdown)
        window.addEventListener('resize', this.checkMobile)
        this.checkMobile()
    },
    beforeDestroy() {
        document.removeEventListener('click', this.closeDropdown)
        window.removeEventListener('resize', this.checkMobile)
    }
}
</script>

<style scoped>
.slide-fade-enter-active,
.slide-fade-leave-active {
    transition: all 0.3s ease;
}

.slide-fade-enter,
.slide-fade-leave-to {
    transform: translateX(100%);
    opacity: 0;
}

.group {
    overflow: hidden;
}
</style>