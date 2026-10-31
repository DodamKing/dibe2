// CreatePlaylistModal.vue
<template>
    <!-- 2026-11: 곡 메뉴 창과 같은 어두운 카드. 모바일은 아래에서 올라오는 시트. Enter 로 만들기, Esc·바깥 누르면 닫기 -->
    <transition name="fade">
        <div v-if="show" class="fixed inset-0 z-[60] bg-black bg-opacity-60 flex items-end sm:items-center justify-center" @click.self="$emit('close')">
            <form class="w-full sm:max-w-sm bg-surface-2 rounded-t-2xl sm:rounded-2xl p-5 sm:p-6" role="dialog" aria-label="새 플레이리스트 만들기"
                @submit.prevent="createPlaylist">
                <h3 class="text-lg font-bold mb-4">새 플레이리스트</h3>
                <label class="sr-only" for="new-playlist-name">플레이리스트 이름</label>
                <input id="new-playlist-name" ref="input" v-model="playlistName" type="text" placeholder="플레이리스트 이름" maxlength="50"
                    class="w-full h-12 px-4 rounded-xl bg-white bg-opacity-5 border border-white border-opacity-10 text-white placeholder-gray-400 focus:outline-none focus:border-purple-400">
                <div class="flex justify-end gap-2 mt-5">
                    <button type="button" class="h-11 px-5 rounded-full text-sm text-gray-300 hover:bg-white hover:bg-opacity-5" @click="$emit('close')">
                        취소
                    </button>
                    <button type="submit" :disabled="!playlistName.trim()"
                        class="h-11 px-5 rounded-full text-sm font-semibold bg-purple-500 hover:bg-purple-600 disabled:opacity-40 disabled:hover:bg-purple-500">
                        만들기
                    </button>
                </div>
            </form>
        </div>
    </transition>
</template>

<script>
export default {
    name: 'CreatePlaylistModal',
    props: {
        show: Boolean
    },
    data() {
        return {
            playlistName: ''
        }
    },
    watch: {
        show(open) {
            if (open) this.$nextTick(() => this.$refs.input && this.$refs.input.focus())
        },
    },
    mounted() {
        document.addEventListener('keydown', this.onKey)
    },
    beforeDestroy() {
        document.removeEventListener('keydown', this.onKey)
    },
    methods: {
        onKey(e) {
            if (e.key === 'Escape' && this.show) this.$emit('close')
        },
        createPlaylist() {
            if (!this.playlistName.trim()) {
                // 이름이 비어있으면 경고
                this.$emit('show-toast', '플레이리스트 이름을 입력해주세요.')
                return
            }
            this.$emit('create', this.playlistName.trim())
            this.playlistName = ''
        }
    }
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.2s;
}

.fade-enter,
.fade-leave-to {
    opacity: 0;
}
</style>
