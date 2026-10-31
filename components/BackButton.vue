<template>
    <!-- 뒤로가기(2026-11 통일). 배경 없는 화살표, 올리면 옅은 원. 제목 바로 왼쪽에 둔다.
         새 탭·주소로 바로 들어와 돌아갈 곳이 없으면 fallback 으로 -->
    <button type="button" class="back-btn" :aria-label="label" :title="label" @click="back">
        <Icon name="arrow-left" :size="22" />
    </button>
</template>

<script>
export default {
    props: {
        fallback: { type: String, default: '/' },
        label: { type: String, default: '뒤로 가기' },
    },
    methods: {
        back() {
            if (window.history.length > 1) this.$router.back()
            else this.$router.push(this.fallback)
        },
    },
}
</script>

<style scoped>
.back-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    margin-left: -8px;
    flex-shrink: 0;
    border-radius: 9999px;
    color: #e5e7eb;
    transition: background-color 0.15s;
}
.back-btn:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
}
</style>
