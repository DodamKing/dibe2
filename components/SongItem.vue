<!-- components/SongItem.vue -->
<template>
    <div class="flex-shrink-0 w-64 p-2">
        <div class="flex items-center bg-gray-800 rounded-lg overflow-hidden">
            <img :src="song.imageUrl" :alt="song.name" class="w-16 h-16 object-cover">
            <div class="ml-3">
                <p class="text-sm font-medium truncate">{{ song.name }}</p>
                <p class="text-xs text-gray-400 truncate">{{ song.artist }}</p>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    name: 'SongItem',
    props: {
        song: {
            type: Object,
            required: true
        }
    }
}
</script>