<template>
    <div
        class="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div class="max-w-md w-full space-y-8 bg-gray-800 p-8 rounded-lg shadow-lg">
            <div>
                <h2 class="mt-6 text-center text-3xl font-extrabold text-white">
                    DIBE2에 로그인
                </h2>
            </div>
            <form class="mt-8 space-y-6" @submit.prevent="login">
                <input type="hidden" name="remember" value="true">
                <div class="rounded-md shadow-sm -space-y-px">
                    <div>
                        <label for="username" class="sr-only">사용자 이름</label>
                        <input id="username" name="username" type="text" required
                            class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 focus:z-10 sm:text-sm"
                            placeholder="사용자 이름" v-model="username">
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
                        로그인
                    </button>
                </div>
            </form>

            <div class="mt-6">
                <div class="relative">
                    <div class="absolute inset-0 flex items-center">
                        <div class="w-full border-t border-gray-300"></div>
                    </div>
                    <div class="relative flex justify-center text-sm">
                        <span class="px-2 bg-gray-800 text-gray-300">
                            Or continue with
                        </span>
                    </div>
                </div>

                <div class="mt-6 grid grid-cols-2 gap-3">
                    <SocialLoginButton provider="kakao" icon="comment" @login="socialLogin" />
                    <SocialLoginButton provider="google" icon="google" @login="socialLogin" />
                </div>
            </div>

            <div class="text-center">
                <p class="mt-2 text-sm text-gray-400">
                    계정이 없으신가요?
                    <nuxt-link to="/register" class="font-medium text-purple-400 hover:text-purple-300">
                        회원가입
                    </nuxt-link>
                </p>
            </div>
        </div>
    </div>
</template>

<script>
import SocialLoginButton from '@/components/SocialLoginButton.vue'

export default {
    components: {
        SocialLoginButton
    },
    data() {
        return {
            username: '',
            password: ''
        }
    },
    methods: {
        async login() {
            try {
                const response = await this.$axios.$post('/api/users/login', {
                    username: this.username,
                    password: this.password
                });
                console.log('로그인 성공:', response);
                this.$router.push('/');
            } catch (error) {
                console.error('로그인 실패:', error);
            }
        },
        socialLogin(provider) {
            console.log(`${provider} 로그인 시도`);
            // 여기에 소셜 로그인 로직 구현
            if (provider === 'kakao') {
                this.kakaoLogin();
            } else if (provider === 'google') {
                this.googleLogin();
            }
        },
        kakaoLogin() {
            // Kakao SDK를 사용한 로그인 로직
        },
        googleLogin() {
            // Google OAuth를 사용한 로그인 로직
        }
    }
}
</script>