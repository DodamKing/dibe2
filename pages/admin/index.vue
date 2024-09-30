<template>
    <div class="min-h-screen bg-gray-100 flex flex-col">
        <!-- 헤더 -->
        <header class="bg-white shadow-sm z-10">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                <h1 class="text-2xl font-semibold text-gray-900">관리자 패널</h1>
                <button class="text-gray-500 hover:text-gray-700">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1">
                        </path>
                    </svg>
                </button>
            </div>
        </header>

        <div class="flex-1 flex">
            <!-- 사이드바 네비게이션 -->
            <nav class="bg-gray-800 w-64 hidden md:block">
                <div class="px-4 py-5 flex flex-col h-full">
                    <ul class="flex-1 space-y-2">
                        <li>
                            <a href="#"
                                class="flex items-center text-gray-300 hover:bg-gray-700 hover:text-white px-2 py-2 rounded-md">
                                <svg class="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                    xmlns="http://www.w3.org/2000/svg">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6">
                                    </path>
                                </svg>
                                대시보드
                            </a>
                        </li>
                        <li>
                            <a href="#"
                                class="flex items-center text-gray-300 hover:bg-gray-700 hover:text-white px-2 py-2 rounded-md">
                                <svg class="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                    xmlns="http://www.w3.org/2000/svg">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z">
                                    </path>
                                </svg>
                                사용자 관리
                            </a>
                        </li>
                        <li>
                            <a href="#"
                                class="flex items-center text-gray-300 hover:bg-gray-700 hover:text-white px-2 py-2 rounded-md">
                                <svg class="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                    xmlns="http://www.w3.org/2000/svg">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z">
                                    </path>
                                </svg>
                                통계
                            </a>
                        </li>
                        <li>
                            <a href="#"
                                class="flex items-center text-gray-300 hover:bg-gray-700 hover:text-white px-2 py-2 rounded-md">
                                <svg class="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                    xmlns="http://www.w3.org/2000/svg">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z">
                                    </path>
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                </svg>
                                설정
                            </a>
                        </li>
                    </ul>
                </div>
            </nav>

            <!-- 메인 콘텐츠 -->
            <main class="flex-1 overflow-y-auto bg-gray-100 p-6">
                <div class="max-w-7xl mx-auto">
                    <!-- 여기에 페이지 컨텐츠가 들어갑니다 -->
                    <h2 class="text-2xl font-semibold text-gray-900 mb-4">대시보드</h2>
                    <div class="bg-white shadow rounded-lg p-6">
                        <p class="text-gray-700">관리자 대시보드에 오신 것을 환영합니다.</p>
                    </div>
                </div>
            </main>
        </div>
    </div>
</template>

<script>
export default {
    // 필요한 메서드나 데이터를 여기에 추가하세요
}
</script>

<style scoped>
/* 필요한 추가 스타일을 여기에 작성하세요 */
</style>