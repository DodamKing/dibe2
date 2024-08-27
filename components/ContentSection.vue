<!-- components/ContentSection.vue (이전의 Section.vue) -->
<template>
    <section class="mb-8">
        <h3 class="text-2xl font-semibold mb-4">{{ title }}</h3>
        <div class="overflow-x-auto">
            <div class="flex space-x-4 pb-4">
                <slot></slot>
            </div>
        </div>
    </section>
</template>

<script>
export default {
    name: 'ContentSection',  // 'Section'에서 'ContentSection'으로 변경
    props: {
        title: {
            type: String,
            required: true
        }
    }
}
</script>

<style scoped>
.overflow-x-auto {
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    /* Firefox */
    -ms-overflow-style: none;
    /* Internet Explorer 10+ */
}

.overflow-x-auto::-webkit-scrollbar {
    display: none;
    /* WebKit */
}</style>