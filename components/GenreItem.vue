<!-- components/GenreItem.vue -->
<template>
    <div class="flex-shrink-0 w-32 h-32">
        <div
            class="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg shadow-lg hover:from-purple-500 hover:to-blue-500 transition duration-300">
            <p class="text-lg font-bold text-white">{{ genre }}</p>
        </div>
    </div>
</template>

<script>
export default {
    name: 'GenreItem',
    props: {
        genre: {
            type: String,
            required: true
        }
    }
}
</script>