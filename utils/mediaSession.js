// utils/mediaSession.js

export function setupMediaSession(store) {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', () => {
            store.dispatch('player/play');
        });

        navigator.mediaSession.setActionHandler('pause', () => {
            store.dispatch('player/pause');
        });

        navigator.mediaSession.setActionHandler('previoustrack', () => {
            store.dispatch('player/playPrevious');
        });

        navigator.mediaSession.setActionHandler('nexttrack', () => {
            store.dispatch('player/playNext');
        });

        // 현재 트랙이 변경될 때마다 메타데이터 업데이트
        store.watch(
            (state) => state.player.currentTrack,
            (newTrack) => {
                if (newTrack) {
                    navigator.mediaSession.metadata = new MediaMetadata({
                        title: newTrack.title,
                        artist: newTrack.artist,
                        album: newTrack.album,
                        artwork: [
                            { src: newTrack.coverUrl, sizes: '96x96', type: 'image/png' },
                            { src: newTrack.coverUrl, sizes: '128x128', type: 'image/png' },
                            { src: newTrack.coverUrl, sizes: '192x192', type: 'image/png' },
                            { src: newTrack.coverUrl, sizes: '256x256', type: 'image/png' },
                            { src: newTrack.coverUrl, sizes: '384x384', type: 'image/png' },
                            { src: newTrack.coverUrl, sizes: '512x512', type: 'image/png' },
                        ]
                    });
                }
            }
        );
    }
}