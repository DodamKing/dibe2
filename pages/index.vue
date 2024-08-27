<template>
	<div class="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900 text-white">
		<AppHeader />
		<MainContent />
		<AppFooter />
	</div>
</template>

<script>
import AppHeader from '../components/AppHeader.vue'
import MainContent from '../components/MainContent.vue'
import AppFooter from '../components/AppFooter.vue'

export default {
	name: 'IndexPage',
	components: {
		AppHeader,
		MainContent,
		AppFooter
	}
}
</script>
