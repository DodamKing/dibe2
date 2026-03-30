<template>
    <div v-if="show" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-2 sm:p-4">
        <div class="bg-gray-800 w-full max-w-4xl rounded-lg shadow-lg overflow-hidden text-white">
            <div class="p-3 sm:p-4 bg-gray-700 flex items-center gap-2">
                <div class="flex-grow relative">
                    <input v-model="localQuery" @keyup.enter="executeSearch" type="text"
                        placeholder="검색어 입력"
                        class="w-full bg-gray-600 text-white placeholder-gray-400 rounded-full py-2 px-4 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <i @click="executeSearch"
                        class="fas fa-search absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 cursor-pointer hover:text-white"></i>
                </div>
                <button @click="$emit('close')" class="text-gray-300 hover:text-white p-1 flex-shrink-0">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="p-3 sm:p-4">
                <div class="flex flex-wrap gap-2 mb-3 sm:mb-4">
                    <button v-for="tab in tabs" :key="tab" @click="changeTab(tab)"
                        :class="['px-2 py-1 sm:px-3 sm:py-2 rounded-md transition-colors text-sm sm:text-base',
                            getApiType(tab) === activeTab ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600']">
                        {{ tab }}
                    </button>
                </div>
                <div class="mb-3 sm:mb-4 flex justify-between items-center">
                    <div class="flex items-center text-sm sm:text-base">
                        <label class="flex items-center cursor-pointer">
                            <input type="checkbox" v-model="selectAll" @change="toggleSelectAll" class="mr-2">
                            <span class="hidden sm:inline">전체 선택</span>
                            <span class="sm:hidden">전체</span>
                            ({{ selectedSongs.length }}곡)
                        </label>
                    </div>
                    <div class="flex gap-2">
                        <button @click="addSelectedToCurrentPlaylist"
                            class="bg-blue-500 text-white px-3 py-1 sm:px-4 sm:py-2 rounded text-sm sm:text-base"
                            :title="'현재 재생목록에 추가'">
                            <i class="fas fa-play-circle sm:hidden"></i>
                            <span class="hidden sm:inline">현재 재생목록에 추가</span>
                        </button>
                        <button @click="showPlaylistModal = true"
                            class="bg-green-500 text-white px-3 py-1 sm:px-4 sm:py-2 rounded text-sm sm:text-base"
                            :title="'플레이리스트에 추가'">
                            <i class="fas fa-plus-circle sm:hidden"></i>
                            <span class="hidden sm:inline">플레이리스트에 추가</span>
                        </button>
                    </div>
                </div>
                <div class="h-[calc(100vh-300px)] sm:h-96 overflow-y-auto custom-scrollbar" ref="scrollContainer"
                    @scroll="handleScroll">
                    <div v-if="filteredResults.length > 0">
                        <div v-for="song in filteredResults" :key="song._id"
                            class="mb-2 p-2 hover:bg-gray-700 rounded transition-colors cursor-pointer"
                            @click="toggleSongSelection(song)">
                            <div class="flex items-center">
                                <input type="checkbox" v-model="selectedSongs" :value="song" class="mr-2" @click.stop>
                                <img :src="song.coverUrl" :alt="song.title" class="w-12 h-12 mr-2 object-cover rounded">
                                <div class="flex-grow min-w-0">
                                    <div class="font-semibold truncate">{{ song.title }}</div>
                                    <div v-if="activeTab === 'album'" class="text-sm text-gray-400 truncate">
                                        {{ song.artist }} - {{ song.album }}
                                    </div>
                                    <div v-else class="text-sm text-gray-400 truncate">{{ song.artist }}</div>
                                </div>
                            </div>
                            <div v-if="activeTab === 'lyrics'" class="text-sm text-gray-300 mt-1 lyrics-clamp"
                                v-html="highlightLyrics(song.lyrics)"></div>
                        </div>
                    </div>
                    <div v-else-if="!loading" class="text-gray-400 text-center py-4">검색 결과가 없습니다.</div>
                    <div v-if="loading" class="text-center py-4">
                        <div class="loader"></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 플레이리스트 선택 모달 -->
        <div v-if="showPlaylistModal"
            class="fixed inset-0 bg-black bg-opacity-50 z-60 flex items-center justify-center p-4">
            <div class="bg-gray-800 p-4 rounded-lg shadow-lg w-full max-w-md">
                <h3 class="text-xl mb-4">플레이리스트 선택</h3>
                <ul class="max-h-60 overflow-y-auto custom-scrollbar">
                    <li v-for="playlist in playlists" :key="playlist._id"
                        class="cursor-pointer p-3 hover:bg-gray-700 rounded mb-1" @click="addToPlaylist(playlist)">
                        {{ playlist.name }}
                    </li>
                </ul>
                <button @click="showPlaylistModal = false" class="mt-4 bg-red-500 text-white px-4 py-2 rounded w-full">
                    취소
                </button>
            </div>
        </div>
    </div>
</template>

<script>
import { mapState, mapActions } from 'vuex'

export default {
    props: {
        show: Boolean,
    },
    data() {
        return {
            tabs: ['제목', '가수', '앨범', '가사'],
            selectedSongs: [],
            selectAll: false,
            showPlaylistModal: false,
            localQuery: '',
        }
    },
    computed: {
        ...mapState({
            searchQuery: state => state.search.searchQuery,
            searchResults: state => state.search.searchResults,
            loading: state => state.search.loading,
            error: state => state.search.error,
            hasMore: state => state.search.hasMore,
            activeTab: state => state.search.activeTab,
            playlists: state => state.playlist.playlists,
        }),
        filteredResults() {
            return this.searchResults
        }
    },
    methods: {
        ...mapActions({
            fetchResults: 'search/fetchResults',
            changeActiveTab: 'search/changeActiveTab',
            performSearch: 'search/performSearch',
            updateSearchQuery: 'search/updateSearchQuery',
            addMultipleToPlaylist: 'player/addMultipleToPlaylist',
            addSongsToPlaylist: 'playlist/addSongsToPlaylist',
        }),
        executeSearch() {
            if (this.localQuery.trim() !== '') {
                this.updateSearchQuery(this.localQuery)
                this.performSearch()
            }
        },
        changeTab(tab) {
            this.changeActiveTab(this.getApiType(tab))
        },
        getApiType(tab) {
            switch (tab) {
                case '제목': return 'title'
                case '가수': return 'artist'
                case '앨범': return 'album'
                case '가사': return 'lyrics'
                default: return 'title'
            }
        },
        handleScroll() {
            const container = this.$refs.scrollContainer
            if (container.scrollTop + container.clientHeight >= container.scrollHeight - 20) {
                this.checkAndFetchMore()
            }
        },
        checkAndFetchMore() {
            if (!this.loading && this.hasMore) {
                this.fetchResults()
            }
        },
        toggleSelectAll() {
            this.selectedSongs = this.selectAll ? [...this.filteredResults] : []
        },
        async addSelectedToCurrentPlaylist() {
            if (this.selectedSongs.length > 0) {
                try {
                    const result = await this.addMultipleToPlaylist(this.selectedSongs)
                    if (result.message === 'SUCCESS') {
                        let msg = `${result.added}곡이 현재 재생목록에 추가되었습니다.`
                        if (result.duplicates > 0) {
                            msg += ` (중복 ${result.duplicates}곡 제외)`
                        }
                        this.$toast.success(msg)
                    } else if (result.message === 'ALL_DUPLICATES') {
                        this.$toast.info('이미 재생목록에 있는 곡입니다.')
                    } else if (result.message === 'QUEUE_FULL') {
                        this.$toast.error('재생목록이 가득 찼습니다. (최대 1000곡)')
                    } else if (result.message === 'QUEUE_LIMIT_EXCEEDED') {
                        this.$toast.error(`재생목록 공간이 부족합니다. (남은 자리: ${result.remaining}곡)`)
                    }
                    this.selectedSongs = []
                    this.selectAll = false
                } catch (error) {
                    console.error('Failed to add songs to current playlist:', error)
                    this.$toast.error('곡을 추가하는 데 실패했습니다.')
                }
            }
        },
        async addToPlaylist(playlist) {
            if (this.selectedSongs.length > 0) {
                try {
                    const { success, addedSongs } = await this.addSongsToPlaylist({
                        playlistId: playlist._id,
                        songs: this.selectedSongs
                    })
                    if (success) {
                        this.$toast.success(`${addedSongs}곡이 "${playlist.name}" 플레이리스트에 추가되었습니다.`)
                        this.selectedSongs = []
                        this.selectAll = false
                        this.showPlaylistModal = false
                    }
                } catch (error) {
                    console.error('Failed to add songs to playlist:', error)
                    this.$toast.error('곡을 플레이리스트에 추가하는 데 실패했습니다.')
                }
            }
        },
        highlightLyrics(lyrics) {
            if (!lyrics) return '';

            const queryRegex = new RegExp(this.searchQuery.replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
            const match = lyrics.match(queryRegex);

            if (!match) return lyrics.substring(0, 100) + '...';

            const matchIndex = lyrics.toLowerCase().indexOf(match[0].toLowerCase());
            const start = Math.max(0, matchIndex - 100);
            const end = Math.min(lyrics.length, matchIndex + match[0].length + 100);

            let snippet = lyrics.substring(start, end);

            // 강조 처리
            snippet = snippet.replace(queryRegex, match => `<mark class="bg-yellow-400 text-gray-800">${match}</mark>`);

            // 시작과 끝 처리
            if (start > 0) snippet = '... ' + snippet;
            if (end < lyrics.length) snippet += ' ...';

            return snippet;
        },
        toggleSongSelection(song) {
            const index = this.selectedSongs.findIndex(s => s._id === song._id);
            if (index > -1) {
                this.selectedSongs.splice(index, 1);
            } else {
                this.selectedSongs.push(song);
            }
        },
    },
    watch: {
        show(newVal) {
            if (newVal) {
                this.localQuery = this.searchQuery
            }
        },
        filteredResults() {
            this.selectAll = false
            this.selectedSongs = []
        }
    },
}
</script>

<style scoped>
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
    border-radius: 2px;
}

.loader {
    border: 3px solid #f3f3f3;
    border-top: 3px solid #3498db;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    animation: spin 1s linear infinite;
    margin: 0 auto;
}

@keyframes spin {
    0% {
        transform: rotate(0deg);
    }

    100% {
        transform: rotate(360deg);
    }
}

/* 폰트어썸 아이콘 크기 조정 */
.fas {
    font-size: 1.2rem;
}

/* 툴팁 스타일 */
[title] {
    position: relative;
}

[title]:hover::after {
    content: attr(title);
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    background-color: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    white-space: nowrap;
    z-index: 10;
}
</style>