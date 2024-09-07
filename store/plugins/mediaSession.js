// store/plugins/mediaSession.js

function getAlbumCoverUrl(baseUrl, size) {
    return baseUrl.replace('/50/', `/${size}/`);
}

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
                console.log(track.coverUrl);
                
                if (track) {
                    const baseUrl = track.coverUrl

                    navigator.mediaSession.metadata = new MediaMetadata({
                        title: track.title,
                        artist: track.artist,
                        album: track.album,
                        artwork: [
                            { src: getAlbumCoverUrl(baseUrl, 96), sizes: '96x96', type: 'image/png' },
                            { src: getAlbumCoverUrl(baseUrl, 128), sizes: '128x128', type: 'image/png' },
                            { src: getAlbumCoverUrl(baseUrl, 192), sizes: '192x192', type: 'image/png' },
                            { src: getAlbumCoverUrl(baseUrl, 256), sizes: '256x256', type: 'image/png' },
                            { src: getAlbumCoverUrl(baseUrl, 512), sizes: '512x512', type: 'image/png' }
                        ]
                    });
                }
            }
        });
    }
};