<!-- components/EventItem.vue -->
<template>
    <div class="flex-shrink-0 w-64">
        <div class="bg-gray-800 rounded-lg overflow-hidden shadow-lg">
            <img :src="event.imageUrl" :alt="event.name" class="w-full h-32 object-cover">
            <div class="p-4">
                <p class="text-sm font-medium truncate">{{ event.name }}</p>
                <p class="text-xs text-gray-400 mt-1">{{ formatDate(event.date) }}</p>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    name: 'EventItem',
    props: {
        event: {
            type: Object,
            required: true
        }
    },
    methods: {
        formatDate(dateString) {
            const options = { year: 'numeric', month: 'long', day: 'numeric' };
            return new Date(dateString).toLocaleDateString('ko-KR', options);
        }
    }
}
</script>