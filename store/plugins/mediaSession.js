// store/plugins/mediaSession.js
function getAlbumCoverUrl(baseUrl, size) {
    return baseUrl.replace('/50/', `/${size}/`);
}

export const mediaSessionPlugin = (store) => {
    if (process.client && 'mediaSession' in navigator) {
        const updateMediaSession = () => {
            const track = store.state.player.currentTrack;
            const isPlaying = store.state.player.isPlaying;

            if (track) {
                // Media Session 메타데이터 강제 덮어쓰기
                const baseUrl = track.coverUrl;

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

                // 재생 상태에 따른 playbackState 설정
                navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
            }
        };

        // Mutation을 더 세밀하게 감지해서 덮어쓰기
        store.subscribe((mutation) => {
            if (mutation.type.startsWith('player/')) {
                // 트랙 변경, 재생 상태 변경 시 강제로 Media Session 갱신
                updateMediaSession();
            }
        });

        // Media Session 액션 핸들러 설정
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

        navigator.mediaSession.setActionHandler('seekto', (details) => {
            store.dispatch('player/seek', details.seekTime);
        });

        // 트랙 변경 또는 재생 상태 변경 시 즉시 업데이트
        updateMediaSession();
    }
};

