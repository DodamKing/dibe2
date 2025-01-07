<template>
    <button @click="login" :disabled="disabled"
        :class="['social-login-btn', `social-login-btn-${provider}`, { 'social-login-btn-disabled': disabled }]">
        <i v-if="provider==='google'" :class="['fab', `fa-${icon}`]"></i>
        <i v-else :class="['fas', `fa-${icon}`]"></i>
        {{ provider }}로 로그인
        <div v-if="disabled" class="tooltip">
            {{ tooltipText }}
        </div>
    </button>
</template>

<script>
export default {
    props: {
        provider: {
            type: String,
            required: true
        },
        icon: {
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
    methods: {
        login() {
            this.$emit('login', this.provider);
        }
    },
}
</script>

<style scoped>
.social-login-btn {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    padding: 10px;
    border: none;
    border-radius: 4px;
    font-size: 16px;
    font-weight: bold;
    cursor: pointer;
    transition: background-color 0.3s;
}

.social-login-btn i {
    margin-right: 10px;
}

.social-login-btn-kakao {
    background-color: #FEE500;
    color: #000000;
}

.social-login-btn-google {
    background-color: #4285F4;
    color: #ffffff;
}

.social-login-btn:hover {
    opacity: 0.9;
}

.social-login-btn-disabled {
    cursor: not-allowed;
}

.social-login-btn-google.social-login-btn-disabled:hover {
    background-color: #858585
}

/* 툴팁 스타일 */ 
.tooltip {
    visibility: hidden;
    position: absolute;
    bottom: 120%;
    left: 50%;
    transform: translateX(-50%);
    background-color: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 14px;
    white-space: nowrap;
    z-index: 1;
}

.tooltip::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    margin-left: -5px;
    border-width: 5px;
    border-style: solid;
    border-color: rgba(0, 0, 0, 0.8) transparent transparent transparent;
}

/* hover 시 툴팁 표시 */
.social-login-btn-disabled:hover .tooltip {
    visibility: visible;
}
</style>