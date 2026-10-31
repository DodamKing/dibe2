<template>
	<main class="w-full max-w-[1600px] mx-auto px-4 sm:px-8 py-6 sm:py-8 flex-grow pb-28 sm:pb-36 flex flex-col gap-2">
		<h1 class="text-2xl sm:text-3xl font-bold">테마</h1>
		<p class="text-sm text-gray-400 mb-4">상황과 기분에 맞춰 고른 50곡. 유튜브에서 많이 함께 듣는 곡을 모았어요.</p>

		<p v-if="!themes.length" class="text-sm text-gray-400 py-6">{{ loaded ? '테마를 불러오지 못했어요.' : '테마를 불러오는 중이에요' }}</p>
		<div v-else class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-6 sm:gap-x-6 sm:gap-y-8">
			<nuxt-link v-for="t in themes" :key="t.key" :to="`/theme/${t.key}`" class="theme-card group">
				<CoverImg :src="t.cover" video class="aspect-square rounded-xl shadow-lg transition-transform duration-200 group-hover:scale-[1.02]" />
				<p class="mt-3 font-bold truncate">{{ t.name }}</p>
				<p class="text-[13px] text-gray-400">{{ t.songCount ? `${Math.min(t.songCount, 50)}곡` : '50곡' }}<template v-if="t.updatedAt"> · {{ fmt(t.updatedAt) }} 갱신</template></p>
			</nuxt-link>
		</div>
	</main>
</template>

<script>
import dayjs from 'dayjs'

export default {
	layout: 'main',
	head() {
		return { title: '테마 | DIBE2' }
	},
	computed: {
		themes() {
			return this.$store.state.themes.list
		},
		loaded() {
			return this.$store.state.themes.loaded
		},
	},
	mounted() {
		this.$store.dispatch('themes/fetchList')
	},
	methods: {
		fmt(d) {
			return dayjs(d).format('M월 D일')
		},
	},
}
</script>
