<template>
  <div>
    <button @click="triggerError">Trigger Vue Error</button>
  </div>
</template>

<script>
export default {
  methods: {
    triggerError() {
      // Vue 컴포넌트 에러 발생
      this.nonExistentMethod()
    }
  }
}
</script>