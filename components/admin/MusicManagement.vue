<template>
    <div>
        <div id="youtube-player"></div>

        <h2 class="text-3xl font-bold text-gray-900 mb-8">음원 관리</h2>
        <div class="bg-white shadow-md rounded-lg overflow-hidden">
            <div class="p-6">
                <div class="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 mb-6">
                    <div class="flex-grow">
                        <input v-model="searchQuery" type="text" placeholder="음원 검색"
                            class="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            @keyup.enter="searchSongs">
                    </div>
                    <div class="flex space-x-2">
                        <select v-model="searchType"
                            class="px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                            <option value="all">전체</option>
                            <option value="title">제목</option>
                            <option value="artist">아티스트</option>
                        </select>
                        <button @click="searchSongs"
                            class="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                            검색
                        </button>
                    </div>
                </div>

                <button @click="showAddModal = true"
                    class="mb-6 px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2">
                    새 음원 추가
                </button>

                <div v-if="loading" class="text-center py-8">
                    <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500">
                    </div>
                    <p class="mt-2 text-gray-600">검색 중...</p>
                </div>

                <div v-else-if="songs.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div v-for="song in songs" :key="song._id"
                        class="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">
                        <picture>
                            <source :srcset="song.coverUrl.replace('/50/', '/700/') || '/default-album-cover.jpg'"
                                media="(min-width: 640px)">
                            <img :src="song.coverUrl.replace('/50/', '/300/') || '/default-album-cover.jpg'"
                                :alt="`${song.title} 앨범 커버`" class="w-full h-48 object-cover">
                        </picture>
                        <div class="p-4">
                            <div class="mb-3">
                                <div class="group relative inline-block w-full">
                                    <h3 class="font-semibold text-lg truncate" :title="song.title">{{ song.title }}</h3>
                                    <div
                                        class="opacity-0 bg-black text-white text-center text-xs rounded-lg py-2 absolute z-10 group-hover:opacity-100 bottom-full left-1/2 -translate-x-1/2 px-3 pointer-events-none">
                                        {{ song.title }}
                                        <svg class="absolute text-black h-2 w-full left-0 top-full" x="0px" y="0px"
                                            viewBox="0 0 255 255" xml:space="preserve">
                                            <polygon class="fill-current" points="0,0 127.5,127.5 255,0" />
                                        </svg>
                                    </div>
                                </div>
                                <div class="group relative inline-block w-full">
                                    <p class="text-gray-600 truncate" :title="song.artist">{{ song.artist }}</p>
                                    <div
                                        class="opacity-0 bg-black text-white text-center text-xs rounded-lg py-2 absolute z-10 group-hover:opacity-100 bottom-full left-1/2 -translate-x-1/2 px-3 pointer-events-none">
                                        {{ song.artist }}
                                        <svg class="absolute text-black h-2 w-full left-0 top-full" x="0px" y="0px"
                                            viewBox="0 0 255 255" xml:space="preserve">
                                            <polygon class="fill-current" points="0,0 127.5,127.5 255,0" />
                                        </svg>
                                    </div>
                                </div>
                                <div class="group relative inline-block w-full">
                                    <p class="text-sm text-gray-500 truncate" :title="song.album">{{ song.album }}</p>
                                    <div
                                        class="opacity-0 bg-black text-white text-center text-xs rounded-lg py-2 absolute z-10 group-hover:opacity-100 bottom-full left-1/2 -translate-x-1/2 px-3 pointer-events-none">
                                        {{ song.album }}
                                        <svg class="absolute text-black h-2 w-full left-0 top-full" x="0px" y="0px"
                                            viewBox="0 0 255 255" xml:space="preserve">
                                            <polygon class="fill-current" points="0,0 127.5,127.5 255,0" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                            <div class="flex justify-between">
                                <button @click="editSong(song)"
                                    class="text-blue-600 hover:text-blue-800 font-medium transition duration-150 ease-in-out">
                                    수정
                                </button>
                                <button @click="playSong(song)"
                                    class="text-green-600 hover:text-green-800 font-medium transition duration-150 ease-in-out">
                                    재생
                                </button>
                                <button @click="deleteSong(song)"
                                    class="text-red-600 hover:text-red-800 font-medium transition duration-150 ease-in-out">
                                    삭제
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- 페이지네이션 또는 "더 보기" 버튼 -->
                    <div v-if="hasMore" class="mt-6 text-center">
                        <button @click="loadMore"
                            class="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition duration-150 ease-in-out">
                            더 보기
                        </button>
                    </div>
                </div>
                <p v-else-if="searchQuery && !loading" class="text-center py-8 text-gray-600">검색 결과가 없습니다.</p>

                <div v-if="hasMore" class="mt-8 text-center">
                    <button @click="loadMore"
                        class="px-6 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2">
                        더 보기
                    </button>
                </div>
            </div>
        </div>

        <!-- 음원 추가/수정 모달 -->
        <div v-if="showAddModal || editingSong"
            class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div class="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
                <h3 class="text-lg font-semibold mb-4">{{ editingSong ? '음원 수정' : '새 음원 추가' }}</h3>

                <!-- 검색 인터페이스 -->
                <div v-if="!editingSong" class="mb-4">
                    <div class="flex mb-2">
                        <input v-model="bugsSearchQuery" @keyup.enter="searchBugs" type="text"
                            placeholder="Bugs에서 음원 검색"
                            class="flex-grow px-3 py-2 border border-gray-300 rounded-l-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm">
                        <button @click="searchBugs"
                            class="px-4 py-2 bg-blue-500 text-white rounded-r-md hover:bg-blue-600 text-sm">
                            검색
                        </button>
                    </div>
                    <!-- 검색 결과 토글 버튼 -->
                    <button v-if="bugsSearchResults.length" @click="toggleSearchResults"
                        class="text-sm text-blue-600 hover:text-blue-800 flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" viewBox="0 0 20 20"
                            fill="currentColor">
                            <path fill-rule="evenodd"
                                d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                                clip-rule="evenodd" />
                        </svg>
                        {{ showSearchResults ? '검색 결과 접기' : '검색 결과 펼치기' }}
                    </button>
                </div>

                <!-- 검색 결과 -->
                <div v-if="showSearchResults && bugsSearchResults.length" class="mb-4 max-h-96 overflow-y-auto">
                    <div v-for="result in bugsSearchResults" :key="result.detailLink"
                        class="p-2 hover:bg-gray-100 cursor-pointer flex items-center space-x-4"
                        @click="selectBugsResult(result)">
                        <img :src="result.coverUrl.replace('/50/', '/150/')" :alt="result.title + ' 앨범 커버'"
                            class="w-16 h-16 object-cover rounded-md">
                        <div>
                            <p class="font-semibold">{{ result.title }}</p>
                            <p class="text-sm text-gray-600">{{ result.artist }} - {{ result.album }}</p>
                        </div>
                    </div>
                </div>

                <form @submit.prevent="saveSong" class="space-y-4">
                    <div>
                        <label for="title" class="block text-sm font-medium text-gray-700">제목</label>
                        <input id="title" v-model="currentSong.title" type="text"
                            class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                    </div>
                    <div>
                        <label for="artist" class="block text-sm font-medium text-gray-700">아티스트</label>
                        <input id="artist" v-model="currentSong.artist" type="text"
                            class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                    </div>
                    <div>
                        <label for="album" class="block text-sm font-medium text-gray-700">앨범</label>
                        <input id="album" v-model="currentSong.album" type="text"
                            class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                    </div>
                    <div>
                        <label for="coverUrl" class="block text-sm font-medium text-gray-700">앨범 커버 URL</label>
                        <input id="coverUrl" v-model="currentSong.coverUrl" type="text"
                            class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                    </div>
                    <div>
                        <label for="detailLink" class="block text-sm font-medium text-gray-700">상세 정보 링크</label>
                        <input id="detailLink" v-model="currentSong.detailLink" type="text"
                            class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                    </div>
                    <div>
                        <label for="lyrics" class="block text-sm font-medium text-gray-700">가사</label>
                        <textarea id="lyrics" v-model="currentSong.lyrics"
                            class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            rows="3"></textarea>
                    </div>
                    <div>
                        <label for="youtubeUrl" class="block text-sm font-medium text-gray-700">YouTube URL</label>
                        <input id="youtubeUrl" v-model="currentSong.youtubeUrl" type="text"
                            class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                    </div>
                    <div class="flex justify-end space-x-2">
                        <button type="button" @click="closeModal"
                            class="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400">
                            취소
                        </button>
                        <button type="submit" class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600">
                            저장
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <!-- 간소화된 YouTube 플레이어 -->
        <div v-if="isPlaying"
            class="fixed bottom-0 right-0 left-0 md:left-64 bg-white shadow-lg border-t border-gray-200 transition-all duration-300 ease-in-out">
            <div class="max-w-3xl mx-auto px-4 py-3">
                <div class="flex items-center justify-between mb-2">
                    <div class="flex-grow mr-4">
                        <h3 class="font-semibold text-gray-800 truncate">{{ currentSong.title }}</h3>
                        <p class="text-sm text-gray-600 truncate">{{ currentSong.artist }}</p>
                    </div>
                    <div class="flex items-center space-x-2">
                        <button @click="togglePlay"
                            class="text-blue-600 hover:text-blue-800 focus:outline-none p-2 transition duration-150 ease-in-out">
                            <i :class="['fas', isPlaying && !isPaused ? 'fa-pause' : 'fa-play']"></i>
                        </button>
                        <button @click="stopPlay"
                            class="text-red-600 hover:text-red-800 focus:outline-none p-2 transition duration-150 ease-in-out">
                            <i class="fas fa-stop"></i>
                        </button>
                    </div>
                </div>
                <div class="flex items-center space-x-2">
                    <span class="text-xs text-gray-500 w-10 text-right">{{ formatTime(currentTime) }}</span>
                    <input type="range" min="0" :max="duration" v-model="currentTime" @input="seekTo" class="flex-grow">
                    <span class="text-xs text-gray-500 w-10">{{ formatTime(duration) }}</span>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import YouTubePlayer from '@/utils/youtubePlayer';

export default {
    name: 'MusicManagement',
    data() {
        return {
            searchQuery: '',
            searchType: 'all',
            songs: [],
            loading: false,
            showAddModal: false,
            editingSong: null,
            bugsSearchQuery: '',
            bugsSearchResults: [],
            currentSong: {
                title: '',
                artist: '',
                album: '',
                coverUrl: '',
                detailLink: '',
                lyrics: '',
                youtubeUrl: ''
            },
            isPlaying: false,
            isPaused: false,
            currentPage: 1,
            limit: 20,
            hasMore: false,
            total: 0,
            currentTime: 0,
            duration: 0,
            showSearchResults: true,
        }
    },
    mounted() {
        YouTubePlayer.init(
            this.onPlayerReady,
            this.onPlayerStateChange,
            this.onPlayerError
        );
        setInterval(this.updateCurrentTime, 1000);
    },
    methods: {
        async searchSongs() {
            if (!this.searchQuery.trim()) return

            this.loading = true;
            this.currentPage = 1;
            this.songs = [];
            await this.fetchSongs();
        },
        async fetchSongs() {
            try {
                const { items, hasMore, total } = await this.$axios.$get('/api/songs/search', {
                    params: {
                        query: this.searchQuery,
                        type: this.searchType,
                        page: this.currentPage,
                        limit: this.limit
                    }
                });
                this.songs = [...this.songs, ...items];
                this.hasMore = hasMore;
                this.total = total;
            } catch (error) {
                console.error('검색 중 오류 발생:', error);
                // 사용자에게 오류 메시지를 표시할 수 있습니다.
            } finally {
                this.loading = false;
            }
        },
        async loadMore() {
            if (this.hasMore) {
                this.currentPage++;
                await this.fetchSongs();
            }
        },
        editSong(song) {
            this.editingSong = song;
            this.currentSong = { ...song };
            this.showAddModal = true;
        },
        async saveSong() {
            try {
                if (this.editingSong) {
                    // 음원 수정
                    const response = await this.$axios.$put(`/api/songs/${this.editingSong._id}`, this.currentSong);

                    if (response.success) {
                        // 성공적으로 수정된 경우
                        const index = this.songs.findIndex(song => song._id === response.updatedSong._id);
                        if (index !== -1) {
                            this.$set(this.songs, index, response.updatedSong);
                        }
                        this.$toast.success(response.message || '음원이 성공적으로 수정되었습니다.');
                        this.closeModal();
                        await this.searchSongs(); // 목록 새로고침
                    } else {
                        // 서버에서 실패 응답을 받은 경우
                        this.$toast.error(response.message || '음원 수정에 실패했습니다.');
                    }
                } else {
                    const response = await this.$axios.$post('/api/songs', this.currentSong);
                    if (response.success) {
                        this.$toast.success(response.message || '새 음원이 성공적으로 추가되었습니다.');
                        this.closeModal();
                        await this.searchSongs(); // 목록 새로고침
                    } else {
                        this.$toast.error(response.message || '음원 추가에 실패했습니다.');
                    }
                }
            } catch (error) {
                console.error('음원 저장 중 오류 발생:', error);
                this.$toast.error('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
            }
        },
        closeModal() {
            this.showAddModal = false;
            this.editingSong = null;
            this.currentSong = {
                title: '',
                artist: '',
                album: '',
                coverUrl: '',
                detailLink: '',
                lyrics: '',
                youtubeUrl: ''
            };
            this.bugsSearchQuery = '';
            this.bugsSearchResults = [];
        },
        deleteSong(song) {
            if (confirm('정말로 이 음원을 삭제하시겠습니까?')) {
                // API 호출하여 음원 삭제
                // await deleteSong(song._id);
                this.searchSongs();
            }
        },
        playSong(song) {
            const videoId = this.extractVideoId(song.youtubeUrl);
            if (videoId) {
                YouTubePlayer.loadVideo(videoId);
                this.isPlaying = true;
                this.isPaused = false;
                this.currentSong = {
                    title: song.title,
                    artist: song.artist
                };
            } else {
                alert('유효한 YouTube URL이 아닙니다.');
            }
        },
        pausePlay() {
            if (this.isPaused) {
                YouTubePlayer.play();
                this.isPaused = false;
            } else {
                YouTubePlayer.pause();
                this.isPaused = true;
            }
        },
        stopPlay() {
            YouTubePlayer.stop();
            this.isPlaying = false;
            this.isPaused = false;
            this.currentTime = 0;
        },
        extractVideoId(url) {
            const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
            const match = url.match(regExp);
            return (match && match[2].length === 11) ? match[2] : null;
        },
        onPlayerReady(event) {
            console.log('YouTube player is ready');
        },
        /* global YT */
        onPlayerStateChange(event) {
            if (event.data === YT.PlayerState.PLAYING) {
                this.duration = YouTubePlayer.getDuration();
            }
        },
        updateCurrentTime() {
            if (this.isPlaying && !this.isPaused) {
                this.currentTime = YouTubePlayer.getCurrentTime();
            }
        },
        togglePlay() {
            if (this.isPaused) {
                YouTubePlayer.play();
                this.isPaused = false;
            } else {
                YouTubePlayer.pause();
                this.isPaused = true;
            }
        },
        seekTo() {
            YouTubePlayer.seek(this.currentTime);
        },
        formatTime(seconds) {
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = Math.floor(seconds % 60);
            return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
        },
        onPlayerError(event) {
            console.error('YouTube player error:', event.data);
        },
        async searchBugs() {
            if (!this.bugsSearchQuery.trim()) return;

            try {
                const response = await this.$axios.$get('/api/songs/search-bugs', {
                    params: { query: this.bugsSearchQuery }
                });
                this.bugsSearchResults = response.results;
                this.showSearchResults = true;
            } catch (error) {
                console.error('Bugs 검색 중 오류 발생:', error);
                this.$toast.error('검색 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
            }
        },

        selectBugsResult(result) {
            this.currentSong = {
                ...this.currentSong,
                title: result.title,
                artist: result.artist,
                album: result.album,
                coverUrl: result.coverUrl,
                detailLink: result.detailLink,
            };
            this.showSearchResults = false;
        },

        toggleSearchResults() {
            this.showSearchResults = !this.showSearchResults;
        },
    }
}
</script>

<style scoped>
input[type="range"] {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 5px;
    border-radius: 5px;
    background: #e2e8f0;
    outline: none;
    opacity: 0.7;
    transition: opacity .2s;
}

input[type="range"]:hover {
    opacity: 1;
}

input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 15px;
    height: 15px;
    border-radius: 50%;
    background: #3b82f6;
    cursor: pointer;
}

input[type="range"]::-moz-range-thumb {
    width: 15px;
    height: 15px;
    border-radius: 50%;
    background: #3b82f6;
    cursor: pointer;
}

@media (hover: hover) {
    .group:hover .absolute {
        display: block;
    }
}

@media (hover: none) {
    .group:active .absolute {
        display: block;
    }
}
</style>