<template>
    <div
        class="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div class="max-w-md w-full space-y-8 bg-gray-800 p-8 rounded-lg shadow-lg">
            <div>
                <h2 class="mt-6 text-center text-3xl font-extrabold text-white">
                    DIBE2 회원가입
                </h2>
            </div>
            <form class="mt-8 space-y-6" @submit.prevent="register">
                <input type="hidden" name="remember" value="true">
                <div class="rounded-md shadow-sm -space-y-px">
                    <div>
                        <label for="username" class="sr-only">사용자 이름</label>
                        <input id="username" name="username" type="text" required
                            class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 focus:z-10 sm:text-sm"
                            placeholder="사용자 이름" v-model="username">
                    </div>
                    <div>
                        <label for="email" class="sr-only">이메일 주소</label>
                        <input id="email" name="email" type="email" required
                            class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-purple-500 focus:border-purple-500 focus:z-10 sm:text-sm"
                            placeholder="이메일 주소" v-model="email">
                    </div>
                    <div>
                        <label for="password" class="sr-only">비밀번호</label>
                        <input id="password" name="password" type="password" required
                            class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 focus:z-10 sm:text-sm"
                            placeholder="비밀번호" v-model="password">
                    </div>
                </div>

                <div>
                    <button type="submit"
                        class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500">
                        회원가입
                    </button>
                </div>
            </form>

            <div class="text-center">
                <p class="mt-2 text-sm text-gray-400">
                    이미 계정이 있으신가요?
                    <nuxt-link to="/login" class="font-medium text-purple-400 hover:text-purple-300">
                        로그인
                    </nuxt-link>
                </p>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            username: '',
            email: '',
            password: ''
        }
    },
    methods: {
        async register() {
            try {
                const response = await this.$axios.$post('/api/users/register', {
                    username: this.username,
                    email: this.email,
                    password: this.password
                });
                console.log('회원가입 성공:', response);
                this.$router.push('/login');
            } catch (error) {
                console.error('회원가입 실패:', error);
                // 에러 처리 (예: 사용자에게 에러 메시지 표시)
            }
        }
    }
}
</script>