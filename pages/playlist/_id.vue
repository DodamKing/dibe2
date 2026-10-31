<template>
    <!-- 플레이리스트 상세(2026-11 새 디자인 — 좋아요·테마 상세와 같은 틀).
         줄 클릭 = 이 플리를 그 곡부터 / 곡 빼기는 ⋯ 메뉴 / 이름은 눌러서 바로 고친다 -->
    <main class="w-full max-w-[1600px] mx-auto px-4 sm:px-8 py-6 sm:py-8 flex-grow pb-28 sm:pb-36 flex flex-col gap-4">
        <div><BackButton /></div>

        <!-- 스토어엔 지난번에 본 플리가 남아 있을 수 있다 — 주소의 id 와 같을 때만 그린다 -->
        <p v-if="loading && !ready" class="text-sm text-gray-400 py-6">불러오는 중이에요</p>

        <div v-else-if="!ready" class="py-10 flex flex-col items-start gap-4">
            <p class="text-lg text-gray-300">{{ error || '플레이리스트를 찾을 수 없어요.' }}</p>
            <button type="button" class="h-10 px-5 rounded-full border border-gray-600 text-sm hover:bg-white hover:bg-opacity-5" @click="$router.push('/')">홈으로</button>
        </div>

        <template v-else>
            <section class="flex items-end gap-4 sm:gap-6">
                <!-- 4곡 이상이면 2×2 모자이크, 그보다 적으면 첫 곡 커버 한 장(홈 카드와 같은 규칙) -->
                <div class="w-28 h-28 sm:w-44 sm:h-44 rounded-xl overflow-hidden bg-surface-2 shadow-lg shrink-0">
                    <div v-if="songs.length >= 4" class="grid grid-cols-2 grid-rows-2 w-full h-full">
                        <img v-for="(song, i) in songs.slice(0, 4)" :key="i" :src="bigCover(song)" alt="" class="w-full h-full object-cover">
                    </div>
                    <img v-else-if="songs.length" :src="bigCover(songs[0])" alt="" class="w-full h-full object-cover">
                    <div v-else class="w-full h-full flex items-center justify-center text-gray-500"><Icon name="music" :size="32" /></div>
                </div>
                <div class="min-w-0 flex-1">
                    <p class="hidden sm:block text-[13px] text-gray-400 mb-1">플레이리스트</p>
                    <button v-if="!isEditing" type="button" class="group flex items-center gap-2 max-w-full text-left" title="이름 바꾸기" @click="startEditing">
                        <h1 class="text-2xl sm:text-4xl font-bold truncate">{{ currentPlaylist.name }}</h1>
                        <Icon name="pencil" :size="18" class="text-gray-500 group-hover:text-white shrink-0" />
                    </button>
                    <form v-else class="flex items-center gap-1" @submit.prevent="saveName">
                        <label class="sr-only" for="playlist-name">플레이리스트 이름</label>
                        <input id="playlist-name" ref="nameInput" v-model="editingName" maxlength="50" @keyup.esc="cancelEditing"
                            class="min-w-0 flex-1 sm:flex-none sm:w-96 h-12 px-3 rounded-xl bg-white bg-opacity-5 border border-white border-opacity-10 text-xl sm:text-2xl font-bold focus:outline-none focus:border-purple-400">
                        <button type="submit" class="w-11 h-11 flex items-center justify-center rounded-full text-purple-300 hover:bg-white hover:bg-opacity-5" aria-label="저장">
                            <Icon name="check" />
                        </button>
                        <button type="button" class="w-11 h-11 flex items-center justify-center rounded-full text-gray-400 hover:bg-white hover:bg-opacity-5" aria-label="취소" @click="cancelEditing">
                            <Icon name="x" />
                        </button>
                    </form>
                    <p class="mt-1.5 text-[13px] text-gray-400">{{ songs.length }}곡{{ estimatedDuration }}</p>
                </div>
            </section>

            <div class="flex items-center gap-2 flex-wrap">
                <button type="button" :disabled="!songs.length" class="flex items-center justify-center gap-1.5 h-11 px-5 rounded-full bg-purple-500 hover:bg-purple-600 text-sm font-semibold disabled:opacity-50"
                    @click="playAll">
                    <Icon name="play" :size="14" filled />전체 재생
                </button>
                <button type="button" :disabled="!songs.length" class="flex items-center justify-center gap-1.5 h-11 px-5 rounded-full border border-gray-600 text-sm text-gray-200 hover:bg-white hover:bg-opacity-5 disabled:opacity-50"
                    @click="shufflePlay">
                    <Icon name="shuffle" :size="16" />셔플
                </button>
                <!-- 삭제는 여기서만(홈 카드엔 두지 않는다). 실수 방지로 한 번 더 묻는다 -->
                <div class="ml-auto flex items-center gap-2">
                    <button v-if="!confirmingDelete" type="button" class="flex items-center gap-1.5 h-10 px-3 rounded-full text-sm text-gray-400 hover:text-red-300 hover:bg-white hover:bg-opacity-5"
                        @click="confirmingDelete = true">
                        <Icon name="trash" :size="16" />삭제
                    </button>
                    <template v-else>
                        <span class="text-sm text-gray-300">정말 삭제할까요?</span>
                        <button type="button" class="h-10 px-4 rounded-full bg-red-500 hover:bg-red-600 text-sm font-semibold" @click="removePlaylist">삭제</button>
                        <button type="button" class="h-10 px-3 rounded-full text-sm text-gray-300 hover:bg-white hover:bg-opacity-5" @click="confirmingDelete = false">취소</button>
                    </template>
                </div>
            </div>

            <div v-if="songs.length" class="flex flex-col">
                <SongRow v-for="(song, index) in songs" :key="song._id || index" :song="song" :song-id="song.songId ? String(song.songId) : null" :rank="index + 1"
                    @play="playFrom(index)" @menu="menuSong = $event" />
            </div>
            <p v-else class="text-sm text-gray-400 py-6">아직 곡이 없어요. 차트나 검색에서 ⋯ → "내 플레이리스트에 담기"로 넣어 보세요.</p>
        </template>

        <SongMenuSheet :song="menuSong" :song-id="menuSong && menuSong.songId ? String(menuSong.songId) : null" removable
            @close="menuSong = null" @add-to-playlist="addToMyPlaylist" @remove="removeSong" />
    </main>
</template>

<script>
import { mapState, mapActions } from 'vuex'
import SongRow from '~/components/SongRow.vue'
import SongMenuSheet from '~/components/SongMenuSheet.vue'

export default {
    components: { SongRow, SongMenuSheet },
    inject: ['layoutMethods'],
    layout: 'main',
    data() {
        return {
            loading: true,
            error: null,
            isEditing: false,
            editingName: '',
            confirmingDelete: false,
            menuSong: null,
        }
    },
    head() {
        return { title: `${(this.currentPlaylist && this.currentPlaylist.name) || '플레이리스트'} | DIBE2` }
    },
    computed: {
        ...mapState('playlist', ['currentPlaylist']),
        ready() {
            return !!(this.currentPlaylist && String(this.currentPlaylist._id) === this.$route.params.id)
        },
        songs() {
            return (this.ready && this.currentPlaylist.songs) || []
        },
        estimatedDuration() {
            if (!this.songs.length) return ''
            const estimatedMinutes = this.songs.length * 3 // 평균 3분으로 가정
            const hours = Math.floor(estimatedMinutes / 60)
            const minutes = estimatedMinutes % 60
            return hours > 0 ? ` · 약 ${hours}시간 ${minutes}분` : ` · 약 ${minutes}분`
        },
    },
    methods: {
        ...mapActions('playlist', ['fetchPlaylistDetail', 'updatePlaylistName', 'removeSongsFromPlaylist', 'deletePlaylist']),
        notice(message) {
            this.$store.commit('player/SET_NOTICE', message)
        },
        bigCover(song) {
            return (song.coverUrl || '').replace('/50/', '/200/')
        },
        async removePlaylist() {
            await this.deletePlaylist(this.currentPlaylist._id)
            this.notice('플레이리스트를 삭제했어요.')
            this.$router.replace('/')
        },
        // 줄 클릭 = 이 플레이리스트를 그 곡부터 / 전체 재생 / 랜덤 재생(셔플을 켜고 시작)
        playFrom(index, shuffle = false) {
            const pl = this.currentPlaylist
            if (!pl.songs.length) return
            this.$store.dispatch('player/playList', {
                source: { type: 'playlist', id: pl._id, name: pl.name },
                songs: pl.songs,
                idKey: 'songId',
                index: shuffle ? null : index,
                shuffle,
            })
        },
        playAll() {
            this.playFrom(0)
        },
        shufflePlay() {
            this.playFrom(null, true)
        },
        addToMyPlaylist(song) {
            this.menuSong = null
            this.layoutMethods.openAddModalFor([song])
        },
        async removeSong(song) {
            try {
                const result = await this.removeSongsFromPlaylist({
                    playlistId: this.currentPlaylist._id,
                    songIds: [song.songId]
                })
                if (result.success) {
                    this.notice('플레이리스트에서 뺐어요.')
                    await this.fetchPlaylistDetail(this.currentPlaylist._id)
                }
            } catch (error) {
                this.notice('곡을 빼지 못했어요. 다시 시도해 주세요.')
            }
        },
        startEditing() {
            this.editingName = this.currentPlaylist.name
            this.isEditing = true
            this.$nextTick(() => {
                this.$refs.nameInput.focus()
                this.$refs.nameInput.select()
            })
        },
        cancelEditing() {
            this.isEditing = false
            this.editingName = ''
        },
        async saveName() {
            const name = this.editingName.trim()
            if (!name || name === this.currentPlaylist.name) {
                this.cancelEditing()
                return
            }
            try {
                const result = await this.updatePlaylistName({ playlistId: this.currentPlaylist._id, name })
                this.notice(result.success ? '이름을 바꿨어요.' : '이름을 바꾸지 못했어요.')
            } catch (error) {
                this.notice('이름을 바꾸지 못했어요.')
                console.error('Error updating playlist name:', error)
            } finally {
                this.cancelEditing()
            }
        },
    },
    async mounted() {
        this.loading = true
        try {
            const success = await this.fetchPlaylistDetail(this.$route.params.id)
            if (!success) this.error = '플레이리스트를 찾을 수 없어요.'
        } catch (error) {
            console.error('Error fetching playlist:', error)
            this.error = '플레이리스트를 불러오지 못했어요.'
        } finally {
            this.loading = false
        }
    },
}
</script>
