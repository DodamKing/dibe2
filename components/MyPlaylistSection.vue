<template>
    <div class="bg-gray-800 bg-opacity-70 rounded-lg shadow-lg p-4 sm:p-6 transition-transform duration-300">
        <div class="flex justify-between items-center mb-4 sm:mb-6">
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
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
            <div @click="$emit('create-playlist')"
                class="relative group cursor-pointer bg-gray-700 rounded-lg flex items-center justify-center aspect-square transition-colors duration-300 hover:bg-gray-600">
                <i class="fas fa-plus text-4xl text-gray-400 group-hover:text-white transition-colors duration-300"></i>
            </div>
            <div v-for="playlist in playlists" :key="playlist._id" class="relative group cursor-pointer">
                <img :src="playlist.coverUrl || 'https://via.placeholder.com/200x200'" :alt="playlist.name"
                    class="w-full aspect-square object-cover rounded-lg shadow-md transition-transform duration-300 group-hover:scale-105">
                <div
                    class="absolute inset-0 bg-gradient-to-t from-black to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-end p-2 sm:p-4">
                    <p class="font-medium text-center text-sm sm:text-lg truncate mb-2">{{ playlist.name }}</p>
                    <button @click.stop="deletePlaylist(playlist._id)" class="text-red-500 hover:text-red-400">
                        <i class="fas fa-trash-alt"></i> 삭제
                    </button>
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
            showDropdown: false
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
            this.$emit('delete-playlist', playlistId)
        },
        managePlaylists() {
            // 플레이리스트 관리 로직
            console.log('플레이리스트 관리')
            // this.showDropdown = false
        },
        sortPlaylists() {
            // 정렬 옵션 로직
            console.log('정렬 옵션')
            // this.showDropdown = false
        }
    },
    mounted() {
        document.addEventListener('click', this.closeDropdown)
    },
    beforeDestroy() {
        document.removeEventListener('click', this.closeDropdown)
    }
}
</script>