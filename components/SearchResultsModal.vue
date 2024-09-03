<template>
    <div v-if="show" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
        <div class="bg-gray-800 w-full max-w-4xl rounded-lg shadow-lg overflow-hidden text-white">
            <div class="p-4 bg-gray-700 flex justify-between items-center">
                <h2 class="text-xl font-semibold">검색 결과: "{{ searchQuery }}"</h2>
                <button @click="$emit('close')" class="text-gray-300 hover:text-white">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="p-4">
                <div class="flex space-x-4 mb-4">
                    <button v-for="tab in tabs" :key="tab" @click="activeTab = tab" :class="['px-3 py-2 rounded-md transition-colors',
                        activeTab === tab ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600']">
                        {{ tab }}
                    </button>
                </div>
                <div class="h-96 overflow-y-auto custom-scrollbar">
                    <template v-if="activeTab === '제목'">
                        <div v-if="results.songs && results.songs.length > 0">
                            <div v-for="song in results.songs" :key="song._id"
                                class="mb-2 p-2 hover:bg-gray-700 rounded transition-colors">
                                <div class="font-semibold">{{ song.title }}</div>
                                <div class="text-sm text-gray-400">{{ song.artist }} - {{ song.album }}</div>
                            </div>
                        </div>
                        <div v-else class="text-gray-400">제목 검색 결과가 없습니다.</div>
                    </template>
                    <template v-else-if="activeTab === '가수'">
                        <div v-if="results.artists && results.artists.length > 0">
                            <div v-for="artist in results.artists" :key="artist._id"
                                class="mb-2 p-2 hover:bg-gray-700 rounded flex items-center transition-colors">
                                <img :src="artist.coverUrl" :alt="artist.artist"
                                    class="w-12 h-12 mr-2 object-cover rounded">
                                <div>
                                    <div class="font-semibold">{{ artist.artist }}</div>
                                    <div class="text-sm text-gray-400">{{ artist.title }} - {{ artist.album }}</div>
                                </div>
                            </div>
                        </div>
                        <div v-else class="text-gray-400">가수 검색 결과가 없습니다.</div>
                    </template>
                    <template v-else-if="activeTab === '앨범'">
                        <div v-if="results.albums && results.albums.length > 0">
                            <div v-for="album in results.albums" :key="album._id"
                                class="mb-2 p-2 hover:bg-gray-700 rounded flex items-center transition-colors">
                                <img :src="album.coverUrl" :alt="album.title"
                                    class="w-12 h-12 mr-2 object-cover rounded">
                                <div>
                                    <div class="font-semibold">{{ album.title }}</div>
                                    <div class="text-sm text-gray-400">{{ album.artist }}</div>
                                    <div class="text-xs text-gray-500">앨범: {{ album.album }}</div>
                                </div>
                            </div>
                        </div>
                        <div v-else class="text-gray-400">앨범 검색 결과가 없습니다.</div>
                    </template>
                    <template v-else-if="activeTab === '가사'">
                        <div v-if="results.lyrics && results.lyrics.length > 0">
                            <div v-for="lyric in results.lyrics" :key="lyric._id"
                                class="mb-2 p-2 hover:bg-gray-700 rounded transition-colors">
                                <div class="flex items-center mb-2">
                                    <img :src="lyric.coverUrl" :alt="lyric.title"
                                        class="w-12 h-12 mr-2 object-cover rounded">
                                    <div>
                                        <div class="font-semibold">{{ lyric.title }}</div>
                                        <div class="text-sm text-gray-400">{{ lyric.artist }}</div>
                                    </div>
                                </div>
                                <div class="text-sm text-gray-300 mt-1" v-html="highlightLyrics(lyric.lyrics)"></div>
                            </div>
                        </div>
                        <div v-else class="text-gray-400">가사 검색 결과가 없습니다.</div>
                    </template>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    props: {
        show: Boolean,
        searchQuery: String,
        results: Object
    },
    data() {
        return {
            activeTab: '제목',
            tabs: ['제목', '가수', '앨범', '가사']
        }
    },
    methods: {
        highlightLyrics(lyrics) {
            if (!this.searchQuery || !lyrics) return '';

            const words = lyrics.split(/\s+/);
            const queryRegex = new RegExp(this.searchQuery, 'gi');
            let foundIndex = -1;

            for (let i = 0; i < words.length; i++) {
                if (queryRegex.test(words[i])) {
                    foundIndex = i;
                    break;
                }
            }

            if (foundIndex === -1) return lyrics.substring(0, 100) + '...';

            const start = Math.max(0, foundIndex - 20);
            const end = Math.min(words.length, foundIndex + 21);
            const relevantWords = words.slice(start, end);

            const highlightedLyrics = relevantWords.map(word => {
                return word.replace(queryRegex, match => `<mark class="bg-yellow-400 text-gray-800">${match}</mark>`);
            }).join(' ');

            return (start > 0 ? '... ' : '') + highlightedLyrics + (end < words.length ? ' ...' : '');
        },
        closeModal(e) {
            if (e.target === e.currentTarget) {
                this.$emit('close');
            }
        }
    },
    watch: {
        results: {
            immediate: true,
            handler(newResults) {
                if (newResults.songs && newResults.songs.length > 0) {
                    this.activeTab = '제목';
                } else if (newResults.artists && newResults.artists.length > 0) {
                    this.activeTab = '가수';
                } else if (newResults.albums && newResults.albums.length > 0) {
                    this.activeTab = '앨범';
                } else if (newResults.lyrics && newResults.lyrics.length > 0) {
                    this.activeTab = '가사';
                }
            }
        }
    },
    mounted() {
        document.addEventListener('keydown', this.handleEscKey);
    },
    beforeDestroy() {
        document.removeEventListener('keydown', this.handleEscKey);
    }
}
</script>

<style scoped>
.custom-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: rgba(155, 155, 155, 0.5) transparent;
}

.custom-scrollbar::-webkit-scrollbar {
    width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
    background-color: rgba(155, 155, 155, 0.5);
    border-radius: 3px;
}

@media (max-width: 768px) {
    .h-96 {
        height: calc(100vh - 200px);
    }
}
</style>