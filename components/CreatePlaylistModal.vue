// CreatePlaylistModal.vue
<template>
    <transition name="fade">
        <div v-if="show" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
            <div class="bg-gray-800 rounded-lg p-6 max-w-sm w-full">
                <h3 class="text-xl font-semibold mb-4">새 플레이리스트 만들기</h3>
                <input v-model="playlistName" type="text" placeholder="플레이리스트 이름"
                    class="w-full bg-gray-700 text-white rounded p-2 mb-4">
                <div class="flex justify-end space-x-2">
                    <button @click="$emit('close')"
                        class="px-4 py-2 bg-gray-600 rounded hover:bg-gray-500 transition-colors duration-300">
                        취소
                    </button>
                    <button @click="createPlaylist"
                        class="px-4 py-2 bg-blue-600 rounded hover:bg-blue-500 transition-colors duration-300">
                        생성
                    </button>
                </div>
            </div>
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
    methods: {
        createPlaylist() {
            if (!this.playlistName.trim()) {
                // 이름이 비어있으면 경고
                this.$emit('show-toast', '플레이리스트 이름을 입력해주세요.')
                return
            }
            this.$emit('create', this.playlistName)
            this.playlistName = ''
        }
    }
}
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s;
}

.fade-enter,
.fade-leave-to {
    opacity: 0;
}</style>