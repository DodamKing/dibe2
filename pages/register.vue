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
                            placeholder="사용자 이름" v-model="username" @blur="validateUsername">
                        <p v-if="errors.username" class="mt-2 text-sm text-red-500">{{ errors.username }}</p>
                    </div>
                    <div>
                        <label for="email" class="sr-only">이메일 주소</label>
                        <input id="email" name="email" type="email" required
                            class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-purple-500 focus:border-purple-500 focus:z-10 sm:text-sm"
                            placeholder="이메일 주소" v-model="email" @blur="validateEmail">
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
                        {{ isSubmitting ? '처리 중...' : '회원가입' }}
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
    layout: 'auth',
    data() {
        return {
            username: '',
            email: '',
            password: '',
            isSubmitting: false,
            errors: {
                username: '',
                email: '',
                password: ''
            }
        }
    },
    methods: {
        validateUsername() {
            this.errors.username = this.username.length < 3 ? '사용자 이름은 3자 이상이어야 합니다.' : ''
        },
        validateEmail() {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            this.errors.email = !emailRegex.test(this.email) ? '유효한 이메일 주소를 입력해주세요.' : ''
        },
        validatePassword() {
            this.errors.password = this.password.length < 8 ? '비밀번호는 8자 이상이어야 합니다.' : ''
        },
        register() {
            return this.$toast.success('기능 막아둠.')

            // this.validateUsername()
            // this.validateEmail()
            // this.validatePassword()

            // if (this.errors.username || this.errors.email || this.errors.password) {
            //     this.$toast.error('입력 정보를 확인해주세요.')
            //     return
            // }

            // this.isSubmitting = true

            // try {
            //     const response = await this.$axios.$post('/api/users/register', {
            //         username: this.username,
            //         email: this.email,
            //         password: this.password
            //     })

            //     this.$toast.success(response.message || '회원가입이 완료되었습니다.')

            //     setTimeout(() => {
            //         this.$router.push('/login')
            //     }, 2000)
            // } catch (error) {
            //     console.error('회원가입 실패:', error)
            //     const errorMessage = error.response?.data?.message || '회원가입 중 오류가 발생했습니다.'
            //     this.$toast.error(errorMessage)

            //     // 이메일 중복 에러 처리
            //     if (errorMessage === '이미 사용 중인 이메일입니다.') {
            //         this.errors.email = errorMessage
            //     }
            // } finally {
            //     this.isSubmitting = false
            // }
        }
    }
}
</script>