<template>
    <button @click="login" :class="['social-login-btn', `social-login-btn-${provider}`]">
        <i v-if="provider==='google'" :class="['fab', `fa-${icon}`]"></i>
        <i v-else :class="['fas', `fa-${icon}`]"></i>
        {{ provider }}로 로그인
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
        }
    },
    methods: {
        login() {
            this.$emit('login', this.provider);
        }
    }
}
</script>

<style scoped>
.social-login-btn {
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
</style>