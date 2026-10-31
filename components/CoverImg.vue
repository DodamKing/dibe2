<template>
    <!-- 곡 커버. 크기·모서리는 부르는 쪽 class 로 준다.
         유튜브 썸네일(hqdefault, 4:3)은 16:9 영상 위아래에 검은 띠가 박혀 있다 → 띠 높이만큼(360/270) 확대해서 잘라 낸다 -->
    <span class="cover-img block overflow-hidden bg-surface-2 shrink-0">
        <img v-if="src" :src="src" alt="" class="w-full h-full object-cover" :class="{ 'yt-crop': video }" :loading="lazy ? 'lazy' : null">
    </span>
</template>

<script>
export default {
    props: {
        src: { type: String, default: '' },
        video: { type: Boolean, default: false },
        lazy: { type: Boolean, default: false },
    },
}
</script>

<style scoped>
.yt-crop {
    transform: scale(1.34);
}
</style>
