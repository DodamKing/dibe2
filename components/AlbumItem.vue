<!-- components/AlbumItem.vue -->
<template>
    <div class="flex-shrink-0 w-40">
        <img :src="album.imageUrl" :alt="album.name" class="w-full h-40 object-cover rounded-lg shadow-lg">
        <p class="mt-2 text-sm font-medium truncate">{{ album.name }}</p>
        <p class="text-xs text-gray-400 truncate">{{ album.artist }}</p>
    </div>
</template>

<script>
export default {
    name: 'AlbumItem',
    props: {
        album: {
            type: Object,
            required: true
        }
    }
}
</script>