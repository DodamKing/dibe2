<template>
    <div class="bg-gray-800 bg-opacity-70 rounded-lg shadow-lg p-4 sm:p-6 transition-transform duration-300">
        <h2 class="text-xl sm:text-2xl font-semibold text-blue-300 mb-4 sm:mb-6">보관함</h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-x-6 sm:gap-y-10">
            <div @click="$emit('create-playlist')"
                class="relative group cursor-pointer bg-gray-700 rounded-lg flex items-center justify-center aspect-video transition-colors duration-300 hover:bg-gray-600">
                <i class="fas fa-plus text-3xl text-gray-400 group-hover:text-white transition-colors duration-300"></i>
            </div>
            <div v-for="playlist in playlists" :key="playlist._id" class="relative group cursor-pointer"
                @click="handleClick(playlist._id)" @touchstart="touchStart(playlist._id, $event)"
                @touchend="touchEnd(playlist._id, $event)" @touchmove="touchMove(playlist._id, $event)">
                <div v-if="playlist.videos.length === 0"
                    class="aspect-video w-full flex flex-col items-center justify-center p-4 bg-gray-700 rounded-lg">
                    <i class="fas fa-video text-3xl text-gray-400 mb-2"></i>
                    <p class="text-center text-xs text-gray-300">아직 영상이 없습니다</p>
                </div>
                <div v-else class="aspect-video w-full rounded-lg overflow-hidden">
                    <img :src="playlist.videos[0].thumbnail" :alt="playlist.videos[0].title"
                        class="w-full h-full object-cover transform transition-transform duration-300 group-hover:scale-105">
                </div>
                <div :class="['absolute inset-0 bg-gradient-to-t from-black to-transparent transition-opacity duration-300 flex flex-col items-center justify-end p-2 sm:p-4 rounded-lg',
                    { 'opacity-0 group-hover:opacity-100': !isMobile },
                    { 'opacity-100': isMobile && activeTouchPlaylist === playlist._id }]">
                    <p class="font-medium text-center text-sm sm:text-base truncate mb-2">{{ playlist.name }}</p>
                    <button v-if="!isMobile && playlistToDelete !== playlist._id" @click.stop="deletePlaylist(playlist._id)"
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
                        class="absolute inset-y-0 right-0 flex items-center bg-gray-800 bg-opacity-90 px-2 py-1 rounded-lg">
                        <button @click.stop="confirmDelete(playlist._id)" class="bg-red-500 text-white text-xs px-2 py-1 rounded mr-1">
                            삭제
                        </button>
                        <button @click.stop="cancelDelete" class="bg-gray-500 text-white text-xs px-2 py-1 rounded">취소</button>
                    </div>
                </transition>
            </div>
        </div>
        <div v-if="playlists.length === 0" class="text-center text-gray-400 text-sm mt-6">
            아직 저장된 플레이리스트가 없습니다. + 버튼으로 만들어보세요.
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
            touchStartX: 0,
            touchEndX: 0,
            swipeThreshold: 50,
            playlistToDelete: null,
            isMobile: false,
            activeTouchPlaylist: null,
            swipedPlaylist: null,
            isSwipeAction: false,
            swipeStartTime: 0,
        }
    },
    methods: {
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
        selectPlaylist(playlistId) {
            this.$emit('select-playlist', playlistId)
        },
        touchStart(playlistId, event) {
            this.touchStartX = event.touches[0].clientX;
            this.swipeStartTime = Date.now();
            this.isSwipeAction = false;
            this.activeTouchPlaylist = playlistId;
        },
        touchMove(playlistId, event) {
            if (Math.abs(event.touches[0].clientX - this.touchStartX) > 10) {
                this.isSwipeAction = true;
                this.activeTouchPlaylist = null;
            }
            if (this.touchStartX - event.touches[0].clientX > this.swipeThreshold) {
                event.preventDefault();
            }
        },
        touchEnd(playlistId, event) {
            this.touchEndX = event.changedTouches[0].clientX;
            const swipeDuration = Date.now() - this.swipeStartTime;

            if (this.isSwipeAction && this.touchStartX - this.touchEndX > this.swipeThreshold) {
                this.swipedPlaylist = playlistId;
            } else if (!this.isSwipeAction && swipeDuration < 300) {
                this.handleClick(playlistId);
            }

            setTimeout(() => {
                this.activeTouchPlaylist = null;
            }, 300);

            this.isSwipeAction = false;
        },
        handleClick(playlistId) {
            if (this.swipedPlaylist === playlistId) return;
            this.selectPlaylist(playlistId);
        },
        checkMobile() {
            this.isMobile = window.innerWidth < 640
        }
    },
    mounted() {
        window.addEventListener('resize', this.checkMobile)
        this.checkMobile()
    },
    beforeDestroy() {
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
