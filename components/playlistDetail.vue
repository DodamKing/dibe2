<!-- PlaylistDetail.vue -->
<template>
    <div v-if="playlist" class="playlist-detail">
        <h2 class="text-2xl font-bold mb-4">{{ playlist.name }}</h2>
        <div class="mb-4 flex justify-between items-center">
            <button @click="toggleEditMode" class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
                {{ isEditMode ? '완료' : '편집' }}
            </button>
            <button v-if="isEditMode" @click="removeSelectedSongs"
                class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded" :disabled="selectedSongs.length === 0">
                선택한 곡 제거 ({{ selectedSongs.length }})
            </button>
        </div>
        <ul class="space-y-2">
            <li v-for="song in playlist.songs" :key="song.songId"
                class="flex items-center p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors duration-200">
                <input v-if="isEditMode" type="checkbox" :checked="selectedSongs.includes(song.songId)"
                    @change="toggleSongSelection(song.songId)" class="mr-2">
                <img :src="song.coverUrl" :alt="song.title" class="w-10 h-10 object-cover rounded mr-3">
                <div class="flex-grow">
                    <p class="font-medium">{{ song.title }}</p>
                    <p class="text-sm text-gray-400">{{ song.artist }}</p>
                </div>
                <button v-if="!isEditMode" @click="removeSong(song.songId)"
                    class="text-red-500 hover:text-red-600 transition-colors duration-200">
                    <i class="fas fa-times"></i>
                </button>
            </li>
        </ul>
    </div>
</template>

<script>
import { mapGetters, mapActions } from 'vuex';

export default {
    data() {
        return {
            isEditMode: false,
            selectedSongs: []
        };
    },
    computed: {
        ...mapGetters('playlist', ['getPlaylistById']),
        playlist() {
            return this.getPlaylistById(this.$route.params.id);
        }
    },
    methods: {
        ...mapActions('playlist', ['removeSongsFromPlaylist']),
        toggleEditMode() {
            this.isEditMode = !this.isEditMode;
            this.selectedSongs = [];
        },
        toggleSongSelection(songId) {
            const index = this.selectedSongs.indexOf(songId);
            if (index > -1) {
                this.selectedSongs.splice(index, 1);
            } else {
                this.selectedSongs.push(songId);
            }
        },
        async removeSong(songId) {
            await this.removeSongsFromPlaylist({
                playlistId: this.playlist._id,
                songIds: [songId]
            });
        },
        async removeSelectedSongs() {
            if (this.selectedSongs.length > 0) {
                await this.removeSongsFromPlaylist({
                    playlistId: this.playlist._id,
                    songIds: this.selectedSongs
                });
                this.selectedSongs = [];
                this.isEditMode = false;
            }
        }
    }
};
</script>