<!-- components/MainContent.vue -->
<template>
    <main class="container mx-auto px-4 py-8 sm:py-16">
        <div class="text-center mb-16">
            <h2 class="text-5xl font-bold mb-4">당신의 음악을 발견하세요</h2>
            <p class="text-xl mb-8">수백만 곡을 스트리밍하고 나만의 완벽한 플레이리스트를 만드세요</p>
            <SearchBar />
        </div>

        <div class="space-y-8">
            <ContentSection title="내 플레이리스트">
                <PlaylistItem v-for="playlist in myPlaylists" :key="playlist.id" :playlist="playlist" />
                <button class="mt-4 text-purple-400 hover:text-purple-300">
                    새 플레이리스트 만들기 +
                </button>
            </ContentSection>

            <ContentSection title="인기 차트">
                <SongItem v-for="song in popularSongs" :key="song.id" :song="song" />
            </ContentSection>

            <ContentSection title="추천 플레이리스트">
                <PlaylistItem v-for="playlist in recommendedPlaylists" :key="playlist.id" :playlist="playlist" />
            </ContentSection>

            <ContentSection title="새로운 발매">
                <AlbumItem v-for="album in newReleases" :key="album.id" :album="album" />
            </ContentSection>

            <ContentSection title="장르 탐색">
                <GenreItem v-for="genre in genres" :key="genre" :genre="genre" />
            </ContentSection>

            <ContentSection title="이벤트 및 콘서트">
                <EventItem v-for="event in events" :key="event.id" :event="event" />
            </ContentSection>
        </div>
    </main>
</template>

<script>
import { mapState } from 'vuex'
import ContentSection from './ContentSection.vue'
import SearchBar from './SearchBar.vue'
import PlaylistItem from './PlaylistItem.vue'
import SongItem from './SongItem.vue'
import AlbumItem from './AlbumItem.vue'
import GenreItem from './GenreItem.vue'
import EventItem from './EventItem.vue'

export default {
    name: 'MainContent',
    components: {
        ContentSection,
        SearchBar,
        PlaylistItem,
        SongItem,
        AlbumItem,
        GenreItem,
        EventItem
    },
    computed: {
        ...mapState([
            'myPlaylists',
            'popularSongs',
            'recommendedPlaylists',
            'newReleases',
            'genres',
            'events'
        ])
    },
    mounted() {
        this.$store.dispatch('fetchMyPlaylists')
        this.$store.dispatch('fetchPopularSongs')
        this.$store.dispatch('fetchRecommendedPlaylists')
        this.$store.dispatch('fetchNewReleases')
        this.$store.dispatch('fetchGenres')
        this.$store.dispatch('fetchEvents')
    }
}
</script>