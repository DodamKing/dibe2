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
                        <label for="email" class="sr-only">이메일</label>
                        <input id="email" name="email" type="text" required
                            class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 focus:z-10 sm:text-sm"
                            placeholder="이메일" v-model="email" @blur="validateEmail">
                        <p v-if="errors.email" class="mt-2 text-sm text-red-500">{{ errors.email }}</p>
                    </div>
                    <div>
                        <label for="password" class="sr-only">비밀번호</label>
                        <input id="password" name="password" type="password" required
                            class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 focus:z-10 sm:text-sm"
                            placeholder="비밀번호" v-model="password" @blur="validatePassword">
                        <p v-if="errors.password" class="mt-2 text-sm text-red-500">{{ errors.password }}</p>
                    </div>
                </div>

                <div>
                    <button type="submit"
                        class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                        :disabled="isSubmitting">
                        {{ isSubmitting ? '로그인 중...' : '로그인' }}
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
            email: '',
            password: '',
            isSubmitting: false,
            errors: {
                email: '',
                password: ''
            }
        }
    },
    methods: {
        validateEmail() {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            this.errors.email = !emailRegex.test(this.email) ? '유효한 이메일 주소를 입력해주세요.' : ''
        },
        validatePassword() {
            this.errors.password = this.password.length < 8 ? '비밀번호는 8자 이상이어야 합니다.' : ''
        },
        async login() {
            // this.validateEmail()
            this.validatePassword()

            if (this.errors.email || this.errors.password) {
                this.$toast.error('입력 정보를 확인해주세요.')
                return
            }

            this.isSubmitting = true

            try {
                const response = await this.$axios.$post('/api/users/login', {
                    email: this.email,
                    password: this.password
                })
                this.$toast.success('로그인에 성공했습니다.')
                console.log('로그인 성공:', response)
                this.$router.push('/')
            } catch (error) {
                console.error('로그인 실패:', error)
                this.handleLoginError(error)
            } finally {
                this.isSubmitting = false
            }
        },
        handleLoginError(error) {
            const statusCode = error.response?.status
            const errorMessage = error.response?.data?.message || '로그인 중 오류가 발생했습니다.'

            if (statusCode === 400) {
                this.$toast.error(errorMessage)
            } else if (statusCode === 500) {
                this.$toast.error('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.')
            } else {
                // 기타 에러
                this.$toast.error(errorMessage)
            }
        },
        socialLogin(provider) {
            console.log(`${provider} 로그인 시도`)
            this.$toast.info(`${provider} 로그인을 시도합니다.`)
            // 여기에 소셜 로그인 로직 구현
            if (provider === 'kakao') {
                this.kakaoLogin()
            } else if (provider === 'google') {
                this.googleLogin()
            }
        },
        kakaoLogin() {
            // Kakao SDK를 사용한 로그인 로직
            this.$toast.info('카카오 로그인 기능은 아직 구현되지 않았습니다.')
        },
        googleLogin() {
            // Google OAuth를 사용한 로그인 로직
            this.$toast.info('구글 로그인 기능은 아직 구현되지 않았습니다.')
        }
    }
}
</script>