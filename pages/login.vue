<template>
    <div class="flex min-h-screen flex-col bg-gray-950 lg:flex-row">
        <div
            class="relative flex flex-1 items-center justify-center overflow-hidden bg-gradient-to-br from-purple-900 via-gray-900 to-blue-900 px-8 py-16 lg:py-0">
            <div class="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-purple-600/30 blur-3xl"></div>
            <div class="pointer-events-none absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-blue-600/25 blur-3xl"></div>
            <div class="relative z-10 max-w-sm text-center lg:text-left">
                <div class="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 backdrop-blur lg:mx-0">
                    <i class="fas fa-music text-2xl text-white"></i>
                </div>
                <h1 class="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">DIBE2</h1>
                <p class="mt-4 text-base text-gray-300 sm:text-lg">
                    내가 고른 음악과 영상을 한 곳에서.
                </p>
            </div>
        </div>

        <div class="flex flex-1 items-center justify-center bg-gray-900 px-6 py-16">
            <div class="w-full max-w-sm">
                <h2 class="text-2xl font-bold text-white">로그인</h2>
                <p class="mt-2 text-sm text-gray-400">소셜 계정으로 간편하게 시작하세요</p>

                <div class="mt-8 space-y-3">
                    <SocialLoginButton provider="google" @login="socialLogin" />
                    <SocialLoginButton provider="kakao" @login="socialLogin" />
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import SocialLoginButton from '@/components/SocialLoginButton.vue'

export default {
    layout: 'auth',
    components: {
        SocialLoginButton
    },
    mounted() {
        this.checkForErrors()
        this.updateTitle()
    },
    methods: {
        updateTitle() {
            document.title = '로그인 | DIBE2'
        },
        socialLogin(provider) {
            this.$toast.info(`${provider} 로그인을 시도합니다.`)
            window.location.href = `/api/users/${provider}`
        },
        checkForErrors() {
            const errorParam = this.$route.query.error
            if (errorParam) {
                this.showErrorToast(errorParam)
                this.$router.replace({ query: {} })
            }
        },
        showErrorToast(error) {
            const errorMessage = this.getErrorMessage(error)
            this.$toast.error(errorMessage)
        },
        getErrorMessage(error) {
            switch (error) {
                case 'invalid_state':
                    return '보안 검증에 실패했습니다. 다시 시도해 주세요.'
                case 'google_login_failed':
                    return 'Google 로그인에 실패했습니다. 다시 시도해 주세요.'
                case 'kakao_login_failed':
                    return 'Kakao 로그인에 실패했습니다. 다시 시도해 주세요.'
                default:
                    return '로그인 중 오류가 발생했습니다. 다시 시도해 주세요.'
            }
        }
    }
}
</script>
