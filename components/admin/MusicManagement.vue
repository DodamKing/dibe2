<template>
    <div>
        <div id="admin-preview-player" class="hidden"></div>

        <h2 class="text-3xl font-bold text-gray-900 mb-8">음원 관리</h2>
        <div class="bg-white shadow-md rounded-lg overflow-hidden">
            <div class="p-6">
                <!-- 모바일은 검색바 한 줄 + [필터/검색/추가] 한 줄. 세로로 쌓으면 스크롤만 길어진다. -->
                <div class="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-4 sm:mb-6">
                    <div class="flex-grow">
                        <input v-model="searchQuery" type="text" placeholder="음원 검색"
                            class="w-full px-4 py-2 min-h-[44px] border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            @keyup.enter="searchSongs">
                    </div>
                    <div class="flex gap-2">
                        <select v-model="searchType"
                            class="flex-1 sm:flex-none px-3 sm:px-4 py-2 min-h-[44px] border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                            <option value="all">전체</option>
                            <option value="title">제목</option>
                            <option value="artist">아티스트</option>
                        </select>
                        <button @click="searchSongs"
                            class="px-5 sm:px-6 py-2 min-h-[44px] bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 whitespace-nowrap">
                            검색
                        </button>
                        <button @click="showAddModal = true"
                            class="sm:hidden px-4 py-2 min-h-[44px] bg-green-600 text-white rounded-md hover:bg-green-700 whitespace-nowrap"
                            aria-label="새 음원 추가">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                </div>

                <!-- 데스크탑 전용 — 모바일은 위 검색줄의 + 아이콘이 대신한다(라벨은 hidden sm:inline 패턴) -->
                <button @click="showAddModal = true"
                    class="hidden sm:block mb-6 px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2">
                    새 음원 추가
                </button>

                <div v-if="loading" class="text-center py-8">
                    <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500">
                    </div>
                    <p class="mt-2 text-gray-600">검색 중...</p>
                </div>

                <!--
                    모바일은 한 곡이 한 줄(썸네일 옆 정보), 데스크탑(sm+)은 기존 카드 그리드.
                    카드 그대로 두면 커버(h-48)가 풀폭으로 늘어나 **한 곡이 화면을 통째로 먹는다**
                    (실측 2026-07-17: 20곡 = 8,542px ≈ 10화면). 관리자는 곡을 훑고 고치는 화면이라
                    목록성이 중요하다. 홈 차트·검색 결과가 쓰는 리스트 패턴과도 맞춘다.
                    마크업을 둘로 나누지 않고 `flex sm:block` 한 벌로 처리한다.
                -->
                <div v-else-if="songs.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
                    <div v-for="song in songs" :key="song._id"
                        class="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300 flex sm:block">
                        <picture class="flex-shrink-0">
                            <source :srcset="coverUrl(song, 700)" media="(min-width: 640px)">
                            <img :src="coverUrl(song, 300)" :alt="`${song.title} 앨범 커버`"
                                class="w-24 h-24 sm:w-full sm:h-48 object-cover">
                        </picture>
                        <div class="p-3 sm:p-4 flex-1 min-w-0 flex flex-col justify-center sm:block">
                            <div class="mb-2 sm:mb-3 min-w-0">
                                <div class="group relative inline-block w-full">
                                    <h3 class="font-semibold text-lg truncate" :title="song.title">{{ song.title }}</h3>
                                    <div
                                        class="hidden sm:block opacity-0 bg-black text-white text-center text-xs rounded-lg py-2 absolute z-10 group-hover:opacity-100 bottom-full left-1/2 -translate-x-1/2 px-3 pointer-events-none">
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
                                        class="hidden sm:block opacity-0 bg-black text-white text-center text-xs rounded-lg py-2 absolute z-10 group-hover:opacity-100 bottom-full left-1/2 -translate-x-1/2 px-3 pointer-events-none">
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
                                        class="hidden sm:block opacity-0 bg-black text-white text-center text-xs rounded-lg py-2 absolute z-10 group-hover:opacity-100 bottom-full left-1/2 -translate-x-1/2 px-3 pointer-events-none">
                                        {{ song.album }}
                                        <svg class="absolute text-black h-2 w-full left-0 top-full" x="0px" y="0px"
                                            viewBox="0 0 255 255" xml:space="preserve">
                                            <polygon class="fill-current" points="0,0 127.5,127.5 255,0" />
                                        </svg>
                                    </div>
                                </div>
                            </div>
                            <!-- 터치 영역 44px 확보(py-2 + min-h) — FRONTEND.md 모바일 규칙 -->
                            <div class="flex gap-1 sm:gap-0 sm:justify-between">
                                <button @click="editSong(song)"
                                    class="px-3 py-2 min-h-[44px] sm:min-h-0 sm:px-0 sm:py-0 text-blue-600 hover:text-blue-800 font-medium transition duration-150 ease-in-out">
                                    수정
                                </button>
                                <button @click="playSong(song)"
                                    class="px-3 py-2 min-h-[44px] sm:min-h-0 sm:px-0 sm:py-0 text-green-600 hover:text-green-800 font-medium transition duration-150 ease-in-out">
                                    재생
                                </button>
                                <button @click="deleteSong(song)"
                                    class="px-3 py-2 min-h-[44px] sm:min-h-0 sm:px-0 sm:py-0 text-red-600 hover:text-red-800 font-medium transition duration-150 ease-in-out">
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
        <!--
            모바일은 풀스크린(top-20 여백을 주면 좁은 화면에서 위쪽만 날리고 폼은 더 밀린다),
            데스크탑은 기존처럼 가운데 뜨는 카드. 제목은 sticky 로 붙여 스크롤해도 맥락이 남는다.
        -->
        <div v-if="showAddModal || editingSong"
            class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div
                class="relative min-h-full sm:min-h-0 sm:top-20 mx-auto p-4 sm:p-5 border w-full max-w-2xl shadow-lg sm:rounded-md bg-white sm:mb-20">
                <h3 class="text-lg font-semibold mb-4 sticky top-0 bg-white py-2 -mt-2 z-10 sm:static sm:py-0 sm:mt-0">
                    {{ editingSong ? '음원 수정' : '새 음원 추가' }}
                </h3>

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
                <!--
                    모바일은 중첩 스크롤을 만들지 않는다(max-h-none). 모달 안에 또 스크롤 박스가 있으면
                    손가락이 어느 쪽을 굴리는지 알 수 없어 스크롤이 갇힌다. 결과가 길면 위의
                    "검색 결과 접기"로 닫으면 된다. 데스크탑은 기존처럼 박스 안에서만 스크롤.
                -->
                <div v-if="showSearchResults && bugsSearchResults.length"
                    class="mb-4 max-h-none sm:max-h-96 sm:overflow-y-auto">
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
                        <div class="flex space-x-2">
                            <input id="youtubeUrl" v-model="currentSong.youtubeUrl" type="text"
                                class="flex-1 mt-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
                            <button type="button" @click="searchYoutubeUrl"
                                :disabled="!currentSong.title || !currentSong.artist"
                                class="mt-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed">
                                <i class="fab fa-youtube mr-2"></i>검색
                            </button>
                        </div>

                        <!-- 검색 결과 토글 버튼 -->
                        <button type="button" v-if="youtubeSearchResults.length" @click="toggleYoutubeResults"
                            class="mt-2 text-sm text-blue-600 hover:text-blue-800 flex items-center">
                            <svg :class="['h-4 w-4 mr-1 transition-transform duration-200',
                                showYoutubeResults ? 'transform rotate-180' : '']" viewBox="0 0 20 20"
                                fill="currentColor">
                                <path fill-rule="evenodd"
                                    d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                                    clip-rule="evenodd" />
                            </svg>
                            {{ showYoutubeResults ? '검색 결과 접기' : '검색 결과 펼치기' }}
                        </button>

                        <!-- Youtube 검색 결과 -->
                        <div v-if="showYoutubeResults && youtubeSearchResults.length" ref="youtubeResults"
                            class="mt-2 border rounded-md overflow-hidden">
                            <!-- 벅스 결과와 같은 이유로 모바일은 중첩 스크롤 없음 -->
                            <div class="max-h-none sm:max-h-64 sm:overflow-y-auto">
                                <!-- form 태그 밖으로 이동시켜야 함 -->
                                <div v-for="result in youtubeSearchResults" :key="result.id"
                                    class="p-3 hover:bg-gray-50 border-b last:border-b-0">
                                    <div class="flex items-center space-x-3">
                                        <div class="relative w-24 h-16 flex-shrink-0">
                                            <img :src="result.thumbnail" class="w-full h-full object-cover rounded">
                                            <!--
                                                모바일엔 hover 가 없다. opacity-0 hover:opacity-100 로 두면
                                                **터치 기기에선 재생 버튼이 영영 안 보인다**(탭하면 동작은 하지만
                                                존재를 알 길이 없다). 모바일은 항상 보이게 하고 오버레이만 옅게.
                                            -->
                                            <div class="absolute inset-0 bg-black bg-opacity-30 sm:bg-opacity-50 rounded flex items-center justify-center opacity-100 sm:opacity-0 sm:hover:opacity-100 transition-opacity cursor-pointer"
                                                @click.prevent="previewYoutubeInModal(result, $event)">
                                                <i class="fas fa-play text-white text-lg drop-shadow"></i>
                                            </div>
                                        </div>
                                        <div class="flex-1 min-w-0 cursor-pointer" @click="selectYoutubeUrl(result)">
                                            <p class="font-medium text-gray-900 truncate">{{ result.title }}</p>
                                            <p class="text-sm text-gray-500 truncate">{{ result.channelTitle }}</p>
                                            <p class="text-xs text-gray-400">{{ result.duration }}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <!-- 미리보기 플레이어에 seek bar 추가 -->
                            <div v-if="isPlaying && previewVideoId" class="border rounded-md bg-gray-50 shadow-sm">
                                <div class="p-3">
                                    <div class="flex items-center justify-between">
                                        <div class="flex-1 mr-4">
                                            <p class="text-sm font-medium truncate">
                                                {{ currentSong.previewTitle || '미리듣기 중...' }}
                                            </p>
                                        </div>
                                        <div class="flex items-center space-x-2">
                                            <button type="button" @click.prevent="togglePreviewPlay"
                                                class="p-1.5 text-gray-600 hover:text-gray-800">
                                                <i :class="['fas', isPaused ? 'fa-play' : 'fa-pause']"></i>
                                            </button>
                                            <button type="button" @click.prevent="stopPreview"
                                                class="p-1.5 text-red-600 hover:text-red-800">
                                                <i class="fas fa-times"></i>
                                            </button>
                                        </div>
                                    </div>
                                    <!-- Seek bar -->
                                    <div class="flex items-center space-x-2 mt-2">
                                        <span class="text-xs text-gray-500">{{ formatTime(currentTime) }}</span>
                                        <input type="range" min="0" :max="duration" :value="currentTime"
                                            @input="handleSeek"
                                            class="flex-1 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer">
                                        <span class="text-xs text-gray-500">{{ formatTime(duration) }}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <!--
                        모바일은 하단에 붙여둔다. 폼이 길어서(7필드 + 검색결과) 저장하려면 매번 끝까지
                        스크롤해야 했다. sticky 라 데스크탑에선 평소처럼 폼 끝에 그대로 있다.
                    -->
                    <div
                        class="flex justify-end gap-2 sticky bottom-0 bg-white py-3 -mx-4 px-4 border-t sm:static sm:py-0 sm:mx-0 sm:px-0 sm:border-0">
                        <button type="button" @click="closeModal"
                            class="px-4 py-2 min-h-[44px] bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400">
                            취소
                        </button>
                        <button type="submit"
                            class="px-6 py-2 min-h-[44px] bg-blue-500 text-white rounded-md hover:bg-blue-600">
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
// 메인 음원 시스템의 utils/youtubePlayer 싱글톤은 절대 import하지 말 것.
// 그것의 player 객체를 덮어쓰면 어드민 진입 후 메인 음원 player가 좀비됨.
// 어드민 미리듣기는 자체 YT.Player 인스턴스로 격리.

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
            showYoutubeResults: false,
            youtubeSearchResults: [],
            player: null,
            updateInterval: null,
        }
    },
    mounted() {
        this.initAdminPlayer()
        this.updateInterval = setInterval(this.updateCurrentTime, 1000)
    },
    beforeDestroy() {
        if (this.updateInterval) clearInterval(this.updateInterval)
        if (this.player && this.player.destroy) {
            try { this.player.destroy() } catch (e) { /* ignore */ }
            this.player = null
        }
    },
    methods: {
        /**
         * 벅스 커버 URL은 경로에 크기가 박혀 있다(.../images/50/...). 그 자리를 바꿔 원하는 크기를 받는다.
         * 예전엔 `song.coverUrl.replace(...) || '/default...'` 였는데, **coverUrl 이 없으면
         * `.replace` 에서 터진다**(폴백이 replace 뒤에 있어서 아무 소용이 없었다).
         */
        coverUrl(song, size) {
            if (!song.coverUrl) return '/default-album-cover.jpg'
            return song.coverUrl.replace('/50/', `/${size}/`)
        },
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
                const songData = Object.entries(this.currentSong).reduce((acc, [key, value]) => {
                    if (value !== null && value !== '') {
                        acc[key] = value;
                    }
                    return acc;
                }, {});

                if (this.editingSong) {
                    // 음원 수정
                    const response = await this.$axios.$put(`/api/songs/${this.editingSong._id}`, songData);

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
                    const response = await this.$axios.$post('/api/songs', songData);
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
            this.youtubeSearchResults = [];
            if (this.isPlaying) {
                this.stopPlay();
            }
            this.stopPreview();
        },
        async deleteSong(song) {
            if (confirm('정말로 이 음원을 삭제하시겠습니까?')) {
                try {
                    const response = await this.$axios.$delete('/api/songs/delete/' + song._id);
                    if (response.success) {
                        this.$toast.success(response.message);
                        await this.searchSongs();
                    } else {
                        this.$toast.error(response.message);
                    }
                } catch (error) {
                    this.$toast.error('음원 삭제 중 오류가 발생했습니다.');
                }
            }
        },
        playSong(song) {
            const videoId = this.extractVideoId(song.youtubeUrl);
            if (videoId) {
                this.player?.loadVideoById(videoId);
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
        stopPlay() {
            this.player?.stopVideo();
            this.isPlaying = false;
            this.isPaused = false;
            this.currentTime = 0;
        },
        extractVideoId(url) {
            const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
            const match = url.match(regExp);
            return (match && match[2].length === 11) ? match[2] : null;
        },
        initAdminPlayer() {
            const create = () => {
                this.player = new YT.Player('admin-preview-player', {
                    host: 'https://www.youtube-nocookie.com',
                    height: '0', width: '0',
                    playerVars: {
                        autoplay: 0,
                        controls: 0,
                        enablejsapi: 1,
                        origin: window.location.origin,
                        playsinline: 1,
                    },
                    events: {
                        onReady: this.onPlayerReady,
                        onStateChange: this.onPlayerStateChange,
                        onError: this.onPlayerError,
                    },
                })
            }

            if (typeof YT !== 'undefined' && YT.Player) {
                create()
            } else {
                // 메인 음원 시스템이 보통 먼저 YT API를 로드하지만, 직접 /admin 진입 등을 대비
                if (!document.querySelector('script[src*="iframe_api"]')) {
                    const tag = document.createElement('script')
                    tag.src = 'https://www.youtube.com/iframe_api'
                    document.head.appendChild(tag)
                }
                const original = window.onYouTubeIframeAPIReady
                window.onYouTubeIframeAPIReady = () => {
                    if (original) original()
                    if (typeof YT !== 'undefined' && YT.Player) create()
                }
            }
        },
        onPlayerReady(event) {
            console.log('Admin preview player is ready');
        },
        /* global YT */
        onPlayerStateChange(event) {
            if (event.data === YT.PlayerState.PLAYING) {
                this.duration = this.player?.getDuration();
            }
        },
        updateCurrentTime() {
            if (this.isPlaying && !this.isPaused) {
                this.currentTime = this.player?.getCurrentTime();
            }
        },
        togglePlay() {
            if (this.isPaused) {
                this.player?.playVideo();
                this.isPaused = false;
            } else {
                this.player?.pauseVideo();
                this.isPaused = true;
            }
        },
        seekTo() {
            this.player?.seekTo(this.currentTime, true);
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

        async searchYoutubeUrl() {
            if (!this.currentSong.title || !this.currentSong.artist) return;

            try {
                const response = await this.$axios.$get('/api/songs/search-youtube', {
                    params: {
                        query: `${this.currentSong.title} ${this.currentSong.artist} official audio`
                    }
                });
                this.youtubeSearchResults = response.results;
                this.showYoutubeResults = true;
                // 결과는 폼 아래에 붙어서 뜬다. 모바일은 화면이 좁아 **검색을 눌러도 아무 일도
                // 안 일어난 것처럼 보인다**(결과가 화면 밖). 결과로 데려다준다.
                this.$nextTick(() => {
                    this.$refs.youtubeResults?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
                })
            } catch (error) {
                console.error('YouTube 검색 중 오류:', error);
                this.$toast.error('YouTube 검색 중 오류가 발생했습니다.');
            }
        },

        selectYoutubeUrl(result) {
            this.currentSong = {
                ...this.currentSong,  // 기존 곡 정보 유지
                youtubeUrl: `https://www.youtube.com/watch?v=${result.id}`  // URL만 업데이트
            };
            this.showYoutubeResults = false;
        },

        toggleYoutubeResults() {
            this.showYoutubeResults = !this.showYoutubeResults;
        },

        previewYoutubeInModal(result, event) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }

            // 같은 영상 클릭 시 토글 동작
            if (this.previewVideoId === result.id) {
                if (this.isPlaying) {
                    if (this.isPaused) {
                        this.player?.playVideo();
                        this.isPaused = false;
                    } else {
                        this.player?.pauseVideo();
                        this.isPaused = true;
                    }
                } else {
                    // 정지된 상태면 다시 재생
                    this.player?.loadVideoById(result.id);
                    this.isPlaying = true;
                    this.isPaused = false;
                }
            } else {
                // 다른 영상이면 새로 재생
                if (this.isPlaying) {
                    this.player?.stopVideo();
                }
                this.previewVideoId = result.id;
                this.player?.loadVideoById(result.id);
                this.isPlaying = true;
                this.isPaused = false;
                this.currentSong = {
                    ...this.currentSong,
                    previewTitle: result.title
                };
            }
        },

        // 미리듣기 전용 토글 함수
        togglePreviewPlay(event) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }

            if (this.isPaused) {
                this.player?.playVideo();
            } else {
                this.player?.pauseVideo();
            }
            this.isPaused = !this.isPaused;
        },

        stopPreview(event) {
            if (event) {
                event.preventDefault();
                event.stopPropagation();
            }

            this.player?.stopVideo();
            this.isPlaying = false;
            this.isPaused = false;
            this.previewVideoId = null;
            this.currentTime = 0;
        },

        handleSeek(event) {
            const time = parseFloat(event.target.value);
            this.player?.seekTo(time, true);
            this.currentTime = time;
        }
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