// store/plugins/mediaSession.js

export const mediaSessionPlugin = (store) => {
    if (process.client && 'mediaSession' in navigator) {
        // Media Session API 설정
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

        // 현재 트랙 변경 감지 및 메타데이터 업데이트
        store.subscribe((mutation, state) => {
            if (mutation.type === 'player/SET_CURRENT_TRACK') {
                const track = state.player.currentTrack;
                if (track) {
                    navigator.mediaSession.metadata = new MediaMetadata({
                        title: track.title,
                        artist: track.artist,
                        album: track.album,
                        artwork: [
                            { src: track.coverUrl, sizes: '96x96', type: 'image/png' },
                            { src: track.coverUrl, sizes: '128x128', type: 'image/png' },
                            { src: track.coverUrl, sizes: '192x192', type: 'image/png' },
                            { src: track.coverUrl, sizes: '256x256', type: 'image/png' },
                            { src: track.coverUrl, sizes: '384x384', type: 'image/png' },
                            { src: track.coverUrl, sizes: '512x512', type: 'image/png' },
                        ]
                    });
                }
            }
        });
    }
};