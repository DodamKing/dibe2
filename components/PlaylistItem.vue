<!-- components/PlaylistItem.vue -->
<template>
    <div class="flex-shrink-0 w-40">
        <img :src="playlist.imageUrl" :alt="playlist.name" class="w-full h-40 object-cover rounded-lg shadow-lg">
        <p class="mt-2 text-sm font-medium truncate">{{ playlist.name }}</p>
    </div>
</template>

<script>
export default {
    name: 'PlaylistItem',
    props: {
        playlist: {
            type: Object,
            required: true
        }
    }
}
</script>