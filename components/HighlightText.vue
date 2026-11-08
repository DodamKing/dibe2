<template>
    <!-- 검색어와 맞은 글자를 강조(utils/highlight.js). v-html 없이 조각으로 그린다 — 곡 제목은 외부(벅스)에서 온 글자 -->
    <span><template v-for="(p, i) in parts"><mark v-if="p.hit" :key="i" class="bg-transparent text-purple-300 font-semibold">{{ p.t }}</mark><template v-else>{{ p.t }}</template></template></span>
</template>

<script>
import { highlightParts } from '~/utils/highlight'

export default {
    props: {
        text: { type: String, default: '' },
        query: { type: String, default: '' },
    },
    computed: {
        parts() {
            return highlightParts(this.text, this.query)
        },
    },
}
</script>
