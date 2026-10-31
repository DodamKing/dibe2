<template>
    <!-- 가사. 지금은 정적 가사(벅스)만 — 싱크 가사는 나중에 앱 먼저(docs/PLAYER_V2_PLAN.md B).
         끼울 자리: lines([{ t: 초, text }])를 넘기면 줄 단위로 그리고 currentTime 에 맞는 줄을 강조한다.
         API 가 `/api/songs/lyrics/:id` 응답에 synced 필드를 추가하면 여기 lines 로 넘기기만 하면 된다 -->
    <div class="lyrics">
        <div v-if="lines && lines.length" class="flex flex-col gap-3">
            <p v-for="(line, i) in lines" :key="i" class="transition-colors"
                :class="i === activeLine ? 'text-white' : 'text-white text-opacity-40'">{{ line.text || '♪' }}</p>
        </div>
        <p v-else class="whitespace-pre-line" :class="{ 'text-gray-400': !hasText }">{{ message }}</p>
    </div>
</template>

<script>
export default {
    props: {
        track: { type: Object, default: null },
        lines: { type: Array, default: null },
        currentTime: { type: Number, default: 0 },
    },
    computed: {
        hasText() {
            return !!(this.track && this.track.kind !== 'video' && !this.track.adult && this.track.lyrics)
        },
        /**
         * 다섯 가지를 구분한다:
         *  - 유튜브 곡(테마): 곡 정보가 우리 DB에 없어 가사가 없다
         *  - 19금  : 벅스가 성인 인증을 요구해 **원리적으로 못 받는다**. "없음"과 구분해서 알린다
         *  - 가사   : 정상
         *  - undefined: 아직 응답 전(서버가 즉석에서 채우는 중일 수 있어 최대 1초쯤 걸린다)
         *  - ''    : 받아왔는데 가사가 원래 없는 곡
         */
        message() {
            const track = this.track
            if (!track) return '재생 중인 곡이 없어요.'
            if (track.kind === 'video') return '유튜브 곡은 가사를 제공하지 않아요.'
            if (track.adult) return '19금 곡은 가사를 제공하지 않습니다.'
            if (track.lyrics) return track.lyrics
            if (track.lyrics === undefined && track._id) return '가사를 불러오는 중...'
            return '가사 정보가 없습니다.'
        },
        activeLine() {
            if (!this.lines) return -1
            let idx = -1
            this.lines.forEach((line, i) => {
                if (line.t <= this.currentTime) idx = i
            })
            return idx
        },
    },
}
</script>

<style scoped>
.lyrics {
    word-break: keep-all;
}
</style>
