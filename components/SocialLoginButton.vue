<template>
    <button type="button" @click="login" :disabled="disabled" :class="[
        'group relative flex w-full items-center justify-center gap-3 rounded-xl px-4 py-3 text-sm font-bold leading-5 transition-all duration-200',
        variantClass,
        disabled ? 'cursor-not-allowed opacity-50' : 'hover:-translate-y-0.5 hover:shadow-md active:translate-y-0'
    ]">
        <svg v-if="provider === 'google'" viewBox="0 0 18 18" class="h-[18px] w-[18px] shrink-0" aria-hidden="true">
            <path fill="#4285F4"
                d="M17.64 9.2045c0-.6381-.0573-1.2518-.1636-1.8409H9v3.4818h4.8436c-.2086 1.125-.8427 2.0782-1.7959 2.7164v2.2581h2.9087c1.7018-1.5668 2.6836-3.8741 2.6836-6.6154z" />
            <path fill="#34A853"
                d="M9 18c2.43 0 4.4673-.806 5.9564-2.1805l-2.9087-2.2581c-.8059.54-1.8368.8591-3.0477.8591-2.3436 0-4.3282-1.5831-5.036-3.7104H.9573v2.3318C2.4382 15.9832 5.4818 18 9 18z" />
            <path fill="#FBBC05"
                d="M3.964 10.71c-.18-.54-.2822-1.1168-.2822-1.71s.1023-1.17.2822-1.71V4.9582H.9573C.3477 6.1732 0 7.5477 0 9s.3477 2.8268.9573 4.0418L3.964 10.71z" />
            <path fill="#EA4335"
                d="M9 3.5795c1.3214 0 2.5077.4541 3.4405 1.346l2.5814-2.5814C13.4632.8918 11.4259 0 9 0 5.4818 0 2.4382 2.0168.9573 4.9582L3.964 7.29C4.6718 5.1627 6.6564 3.5795 9 3.5795z" />
        </svg>
        <svg v-else viewBox="20 32 216 202" class="h-[18px] w-[18px] shrink-0" aria-hidden="true">
            <path fill="#000000"
                d="M128 36C70.562 36 24 72.712 24 118c0 29.279 19.466 54.97 48.748 69.477-1.593 5.494-10.237 35.315-10.581 37.628 0 0-.207 1.762.934 2.434 1.14.673 2.483.157 2.483.157 3.272-.457 37.943-24.811 43.986-29.04 6.026.845 12.235 1.284 18.43 1.284 57.438 0 104-36.712 104-82S185.438 36 128 36z" />
        </svg>
        <span>{{ label }}</span>
        <span v-if="disabled"
            class="pointer-events-none absolute -top-11 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-black/85 px-3 py-1.5 text-xs font-normal text-white opacity-0 transition-opacity group-hover:opacity-100">
            {{ tooltipText }}
        </span>
    </button>
</template>

<script>
export default {
    props: {
        provider: {
            type: String,
            required: true
        },
        disabled: {
            type: Boolean,
            default: false
        },
        tooltipText: {
            type: String,
            default: '현재 이 로그인 방식은 일시적으로 사용할 수 없습니다.'
        }
    },
    computed: {
        label() {
            return this.provider === 'kakao' ? '카카오 로그인' : 'Google 로그인'
        },
        variantClass() {
            return this.provider === 'kakao'
                ? 'bg-[#FEE500] text-black/85'
                : 'bg-white text-[#1F1F1F] border border-[#747775]'
        }
    },
    methods: {
        login() {
            if (this.disabled) return
            this.$emit('login', this.provider)
        }
    }
}
</script>
