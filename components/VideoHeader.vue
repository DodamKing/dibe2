<template>
    <header class="sticky top-0 z-30 h-16 bg-gradient-to-r from-purple-800 to-blue-700 shadow-lg">
        <div class="container mx-auto h-full flex justify-between items-center px-4">
            <div class="flex items-baseline space-x-2 text-white">
                <span class="text-xl sm:text-2xl font-bold">DIBE2</span>
                <span class="text-sm sm:text-base text-gray-200">비디오</span>
            </div>
            <div class="flex items-center space-x-4">
                <NuxtLink to="/" aria-label="음원 모드로" title="음원 모드로"
                    class="text-white hover:text-gray-200 flex items-center">
                    <i class="fas fa-music text-lg"></i>
                </NuxtLink>
                <UserMenu />
            </div>
        </div>
    </header>
</template>

<script>
import UserMenu from '~/components/UserMenu.vue'

export default {
    components: { UserMenu }
}
</script>

<style scoped>
/* 안전망: 다른 layout에서도 .container overflow-x:hidden 류가 적용되더라도
   드롭다운이 잘리지 않도록. (자세한 원인은 AppHeader.vue 동일 처리 참고) */
header > .container {
    overflow-x: visible;
    overflow-y: visible;
}
</style>
