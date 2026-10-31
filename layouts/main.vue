<template>
    <div class="min-h-screen bg-surface-0 text-white flex flex-col">
        <AppHeader />
        <Nuxt />

        <!-- 겹치는 순서: 데스크탑은 미니 플레이어(50) > 대기열 서랍(46) > 지금 재생 중(45).
             모바일은 지금 재생 중이 미니 플레이어까지 덮고(55), 거기서 여는 대기열이 그 위(60) -->
        <NowPlaying :show="showNowPlaying" class="z-[55] sm:z-[45]" @close="showNowPlaying = false" @open-queue="showQueue = true" />
        <QueuePanel :show="showQueue" class="z-[60] sm:z-[46]" @close="showQueue = false" />
        <MusicPlayer :queue-open="showQueue" :now-playing-open="showNowPlaying" class="z-50"
            @toggle-queue="toggleQueue" @open-now-playing="showNowPlaying = true" />

        <CreatePlaylistModal :show="showCreatePlaylistModal" @close="showCreatePlaylistModal = false"
            @create="handleCreatePlaylist" @show-toast="showToast" />

        <!-- 화면 아래 알림 — 미니 플레이어 바로 위 가운데, 어두운 알약(2026-11. 예전 초록 상자) -->
        <transition name="fade">
            <div v-if="toastVisible" role="status"
                class="fixed left-1/2 transform -translate-x-1/2 bottom-[84px] sm:bottom-24 z-[70] max-w-[90vw] px-4 py-2.5 rounded-full bg-white text-gray-900 text-sm font-medium shadow-2xl text-center">
                {{ toastMessage }}
            </div>
        </transition>

        <!-- 여러 곡을 담는 중 -->
        <div v-if="isAdding" class="fixed inset-0 bg-black bg-opacity-60 z-[70] flex items-center justify-center p-4">
            <div class="bg-surface-2 rounded-2xl p-6 w-full max-w-xs text-center" role="status">
                <Icon name="loader" :size="36" class="animate-spin text-purple-400 mx-auto mb-3" />
                <p class="font-semibold">곡을 담는 중이에요</p>
                <div class="w-full bg-white bg-opacity-10 rounded-full h-1.5 mt-4 overflow-hidden">
                    <div class="bg-purple-400 h-full rounded-full transition-all" :style="{ width: `${progressPercentage}%` }"></div>
                </div>
            </div>
        </div>

        <!-- 선택한 곡 담기(차트에서 선택 → "선택 곡 담기", 곡 메뉴의 "내 플레이리스트에 담기") — 2026-11 새 디자인.
             모바일은 아래 시트, 데스크탑은 가운데 창 -->
        <transition name="fade">
            <div v-if="showAddToPlaylistModal"
                class="fixed inset-0 bg-black bg-opacity-60 z-[60] flex items-end sm:items-center justify-center"
                @click.self="closeAddToPlaylistModal">
                <div class="w-full sm:max-w-sm max-h-[80vh] flex flex-col bg-surface-2 rounded-t-2xl sm:rounded-2xl pt-4 pb-3 px-2" role="dialog" aria-label="담기">
                    <div class="flex items-center justify-between pl-3 pr-1 pb-2">
                        <div class="min-w-0">
                            <h3 class="text-lg font-bold">담기</h3>
                            <p class="text-[13px] text-gray-400">{{ selectedSongs.length }}곡 선택됨</p>
                        </div>
                        <button type="button" class="w-11 h-11 flex items-center justify-center rounded-full text-gray-400 hover:text-white" aria-label="닫기" @click="closeAddToPlaylistModal">
                            <Icon name="x" />
                        </button>
                    </div>
                    <button type="button" class="sheet-item" @click="addToCurrentPlaylist">
                        <Icon name="list-music" class="text-gray-300" />재생 대기열에 추가
                    </button>
                    <p class="px-3 pt-3 pb-1 text-xs font-medium text-gray-400">내 플레이리스트</p>
                    <div class="overflow-y-auto overscroll-contain">
                        <button type="button" class="sheet-item" @click="closeAddToPlaylistModal(); _showCreatePlaylistModal()">
                            <span class="w-9 h-9 rounded-md border border-dashed border-white border-opacity-30 flex items-center justify-center shrink-0"><Icon name="plus" :size="16" /></span>
                            새 플레이리스트
                        </button>
                        <button v-for="playlist in playlists" :key="playlist._id" type="button" class="sheet-item" @click="addToSelectedPlaylist(playlist._id)">
                            <CoverImg :src="playlist.songs && playlist.songs[0] ? playlist.songs[0].coverUrl : ''" class="w-9 h-9 rounded-md" />
                            <span class="min-w-0 flex-1 text-left">
                                <span class="block truncate">{{ playlist.name }}</span>
                                <span class="block text-xs text-gray-400">{{ playlist.songs ? playlist.songs.length : 0 }}곡</span>
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        </transition>

        <!-- 푸터 -->
        <!-- 내가 만들었음 -->
    </div>
</template>

<script>
import dayjs from 'dayjs'
import 'dayjs/locale/ko'
import { mapState, mapActions } from 'vuex'
import MusicPlayer from '~/components/MusicPlayer.vue'
import AppHeader from '~/components/AppHeader.vue'
import QueuePanel from '~/components/QueuePanel.vue'
import NowPlaying from '~/components/NowPlaying.vue'
import CreatePlaylistModal from '~/components/CreatePlaylistModal.vue'

export default {
    provide() {
        return {
            layoutMethods: {
                selectAll: this.selectAll,
                showAddToPlaylistModal: this._showAddToPlaylistModal,
                isSongSelected: this.isSongSelected,
                toggleSongSelection: this.toggleSongSelection,
                showCreatePlaylistModal: this._showCreatePlaylistModal,
                deletePlaylist: this._deletePlaylist,
                // 곡 몇 개를 골라 "플레이리스트 선택" 모달을 연다(모바일 곡 메뉴의 "담기" 등)
                openAddModalFor: this.openAddModalFor,
                setSelectedSongs: (songs) => { this.selectedSongs = [...songs] },
                // 필요한 다른 메서드들도 여기에 추가
            },
            layoutData: {
                popularChart: () => this.popularChart,
                lastChartUpdated: () => this.lastChartUpdated,
                popChart: () => this.popChart,
                lastPopUpdated: () => this.lastPopUpdated,
                playlists: () => this.playlists,
                selectedSongs: () => this.selectedSongs,
                allSelected: () => this.allSelected,
                // 필요한 다른 데이터들도 여기에 추가
            }
        }
    },
    watch: {
        notice(message) {
            if (!message) return
            this.showToast(message)
            this.$store.commit('player/SET_NOTICE', null)
        },
        isAdding(newValue) {
            if (newValue) {
                this.startProgress()
            } else {
                this.stopProgress()
            }
        }
    },
    components: {
        MusicPlayer,
        AppHeader,
        QueuePanel,
        NowPlaying,
        CreatePlaylistModal,
    },
    head() {
        // currentTrack 있으면 곡 정보로, 없으면 기본 'DIBE2'. 일시정지 중에도 곡 유지 (Spotify/Bugs 컨벤션).
        // 페이지에서 head() 정의하면 그쪽이 우선이므로 페이지별 커스텀 가능.
        const t = this.currentTrack
        return {
            title: t ? `${t.title} - ${t.artist} | DIBE2` : 'DIBE2',
        }
    },
    computed: {
        ...mapState('player', ['currentTrack', 'notice']),
        ...mapState('playlist', ['playlists']),
        ...mapState('search', ['showSearchResults']),
        allSelected() {
            return this.selectedSongs.length === this.popularChart.length
        },
    },
    data() {
        return {
            searchQuery: '',
            showQueue: false,
            showNowPlaying: false,
            popularChart: [],
            lastChartUpdated: '',
            popChart: [],
            lastPopUpdated: '',
            selectedSongs: [],
            showPlaylistSelectionModal: false,
            currentSongForPlaylist: null,
            toastVisible: false,
            toastMessage: '',
            isAdding: false,
            progressPercentage: 0,
            searchResults: [],
            showCreatePlaylistModal: false,
            showDropdown: false,
            showAddToPlaylistModal: false,
        }
    },
    methods: {
        ...mapActions('player', ['addToQueue']),
        ...mapActions('playlist', ['fetchPlaylists', 'createPlaylist', 'deletePlaylist', 'addSongsToPlaylist']),
        ...mapActions('search', ['closeSearchResults']),
        toggleQueue() {
            this.showQueue = !this.showQueue;
        },
        // 국내(/chart)·해외(/chart/pop) 공통. 캐시를 먼저 보여주고 백그라운드로 새로 받는다.
        async fetchChart({ url, cacheKey, itemsKey, updatedKey }) {
            const fmt = d => dayjs(d).locale('ko').format('M월 D일 A h시')

            // 1) 캐시 즉시 표시
            try {
                const cached = localStorage.getItem(cacheKey)
                if (cached) {
                    const { items, lastUpdated } = JSON.parse(cached)
                    if (items && Array.isArray(items)) {
                        this[itemsKey] = items
                        this[updatedKey] = fmt(lastUpdated)
                    }
                }
            } catch (err) {
                // 캐시 파싱 실패는 무시
            }

            // 2) 백그라운드 fresh 갱신
            try {
                const { chart } = await this.$axios.$get(url)
                if (!chart) return // 해외 차트는 수집 전이면 null
                this[itemsKey] = chart.items
                this[updatedKey] = fmt(chart.lastUpdated)
                // 차트 응답의 liked 를 공유 좋아요 상태에 반영(키는 songId — 항목 _id 는 곡이 아님)
                this.$store.dispatch('likes/seed', chart.items.map(i => ({ id: i.songId, liked: i.liked })))
                try {
                    // liked 는 사용자마다 다른데 이 캐시는 사용자 구분이 없다 → 빼고 저장(계정을 바꾸면 남의 하트가 보인다)
                    localStorage.setItem(cacheKey, JSON.stringify({
                        items: chart.items.map(({ liked, ...item }) => item),
                        lastUpdated: chart.lastUpdated,
                    }))
                } catch (err) {
                    // localStorage 용량 초과 등 무시
                }
            } catch (err) {
                // 네트워크 에러 시 캐시 데이터 유지
            }
        },
        fetchPopularChart() {
            return this.fetchChart({ url: '/api/songs/chart', cacheKey: 'dibe2_chart_cache', itemsKey: 'popularChart', updatedKey: 'lastChartUpdated' })
        },
        fetchPopChart() {
            return this.fetchChart({ url: '/api/songs/chart/pop', cacheKey: 'dibe2_pop_chart_cache', itemsKey: 'popChart', updatedKey: 'lastPopUpdated' })
        },
        openAddModalFor(songs) {
            this.selectedSongs = [...songs]
            this.showAddToPlaylistModal = true
        },
        handleKeyDown(e) {
            // 위에 떠 있는 것부터 하나씩 닫는다
            if (e.key === 'Escape' && this.showQueue) {
                this.toggleQueue()
            } else if (e.key === 'Escape' && this.showNowPlaying) {
                this.showNowPlaying = false
            }

            if (e.key === 'Escape' && this.showAddToPlaylistModal) {
                this.closeAddToPlaylistModal();
            }

            if (e.key === 'Escape' && this.showSearchResults) {
                this.closeSearchResults()
            }
        },
        toggleSongSelection(song) {
            const index = this.selectedSongs.findIndex(s => s.title === song.title && s.artist === song.artist)
            if (index === -1) {
                this.selectedSongs.push(song)
            } else {
                this.selectedSongs.splice(index, 1)
            }
        },
        isSongSelected(song) {
            return this.selectedSongs.some(s => s.title === song.title && s.artist === song.artist)
        },
        selectAll() {
            if (this.allSelected) {
                this.selectedSongs = []
            } else {
                this.selectedSongs = [...this.popularChart]
            }
        },
        _showAddToPlaylistModal() {
            this.showAddToPlaylistModal = true
        },
        closeAddToPlaylistModal() {
            this.showAddToPlaylistModal = false
        },
        async addToCurrentPlaylist() {
            if (this.isAdding) return

            this.isAdding = true
            try {
                // 차트 항목이면 곡 id 는 `songId`(항목 _id 는 곡이 아님), DB 곡이면 `_id`
                const songs = this.selectedSongs.map(s => ({ ...s, _id: 'songId' in s ? s.songId : s._id }))
                const { added, full } = await this.addToQueue({ songs, idKey: '_id' })
                this.showToast(!added ? '재생 대기열이 가득 찼어요. (최대 1000곡)'
                    : full ? `대기열에 ${added}곡만 추가했어요. (최대 1000곡)`
                        : `${added}곡을 대기열에 추가했어요.`)
                if (added) this.selectedSongs = []
            } catch (err) {
                console.error('Failed to add songs to queue:', err)
                this.showToast('대기열에 추가하지 못했어요.')
            } finally {
                this.isAdding = false
                this.closeAddToPlaylistModal()
            }
        },
        async addToSelectedPlaylist(playlistId) {
            if (this.isAdding) return

            this.isAdding = true
            try {
                // 차트 항목의 `_id`는 곡이 아니라 차트 항목 id다 — 곡 id 는 `songId`
                const songs = this.selectedSongs.map(s => ({ ...s, _id: s.songId || s._id }))
                const { success, addedSongs } = await this.addSongsToPlaylist({ playlistId, songs })
                if (success) this.showToast(`${addedSongs}곡이 선택한 플레이리스트에 추가되었습니다.`)
                else this.showToast('예기치 못한 에러 발생으로 곡 추가에 실패했습니다.')
                this.selectedSongs = []
            } catch (err) {
                console.error('Failed to add songs to playlist:', err)
                this.showToast('곡을 플레이리스트에 추가하는 데 실패했습니다.')
            } finally {
                this.isAdding = false
                this.closeAddToPlaylistModal()
            }
        },
        showToast(message) {
            this.toastMessage = message
            this.toastVisible = true
            setTimeout(() => {
                this.toastVisible = false
            }, 3000)
        },
        startProgress() {
            this.progressPercentage = 0
            clearInterval(this.intervalId)
            this.intervalId = setInterval(() => {
                if (this.progressPercentage < 90) {
                    this.progressPercentage += Math.random() * 15 + 5
                    if (this.progressPercentage > 90) {
                        const increment = Math.random() * 10 + 2
                        this.progressPercentage = Math.min(90, this.progressPercentage + increment)
                    }
                }
            }, 200)
        },
        stopProgress() {
            clearInterval(this.intervalId)
            this.progressPercentage = 100
            setTimeout(() => {
                this.isAdding = false
                this.progressPercentage = 0
            }, 500)
        },
        async handleCreatePlaylist(name) {
            try {
                await this.createPlaylist(name);
                this.showCreatePlaylistModal = false;
                this.showToast('새 플레이리스트가 생성되었습니다.');
            } catch (error) {
                this.showToast('플레이리스트 생성에 실패했습니다.');
            }
        },
        toggleDropdown() {
            this.showDropdown = !this.showDropdown
        },
        async _deletePlaylist(playlistId) {
            try {
                await this.deletePlaylist(playlistId)
                this.showToast('플레이리스트 삭제되었습니다.')
            } catch (err) {
                this.showToast('플레이리스트 삭제에 실패했습니다.')
            }
        },
        _showCreatePlaylistModal() {
            this.showCreatePlaylistModal = true
        },
    },
    mounted() {
        this.fetchPopularChart()
        this.fetchPopChart()
        this.$store.dispatch('likes/fetchTotal')
        document.addEventListener('keydown', this.handleKeyDown)
        this.fetchPlaylists()
        this.$store.dispatch('player/initializeAudioSystem')
    },
    beforeDestroy() {
        document.removeEventListener('keydown', this.handleKeyDown)
    }
}
</script>

<style>
/* 담기 시트의 줄 */
.sheet-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 52px;
    padding: 6px 12px;
    border-radius: 10px;
    font-size: 15px;
    text-align: left;
}
.sheet-item:hover { background: rgba(255, 255, 255, 0.06); }

.slide-up-enter-active,
.slide-up-leave-active {
    transition: all 0.3s ease-out;
}

.slide-up-enter-from,
.slide-up-leave-to {
    transform: translateY(100%);
}

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

.container {
    max-width: 100%;
    overflow-x: hidden;
}

@keyframes spin {
    from {
        transform: rotate(0deg);
    }

    to {
        transform: rotate(360deg);
    }
}

.animate-spin {
    animation: spin 1s linear infinite;
}

@media (max-width: 640px) {
    .pb-24 {
        padding-bottom: 5rem;
    }

    button,
    a {
        min-height: 44px;
        min-width: 44px;
    }
}

@media (hover: none) and (pointer: coarse) {
    .custom-scrollbar {
        -webkit-overflow-scrolling: touch;
    }
}

.slide-up-enter-active,
.slide-up-leave-active {
    transition: all 0.3s ease-out;
}

.slide-up-enter-from,
.slide-up-leave-to {
    transform: translateY(100%);
}

/* 모바일 환경을 위한 추가 스타일 */
@media (max-width: 640px) {
    .fixed.bottom-0 {
        padding-bottom: env(safe-area-inset-bottom);
    }
}
</style>