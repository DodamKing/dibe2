<template>
    <div class="relative max-w-2xl mx-auto">
        <input type="text" placeholder="아티스트, 노래, 또는 플레이리스트 검색"
            class="w-full bg-white bg-opacity-20 rounded-full py-3 px-6 pr-12 focus:outline-none focus:ring-2 focus:ring-purple-500">
        <button class="absolute right-3 top-1/2 transform -translate-y-1/2">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
        </button>
    </div>
</template>

<script>
export default {
    name: 'SearchBar'
}
</script>