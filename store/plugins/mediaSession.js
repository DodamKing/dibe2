// store/plugins/mediaSession.js

// 벅스 커버는 주소의 /50/ 만 바꾸면 그 크기가 나온다. 유튜브 썸네일(테마 곡)은 크기별 주소가 없어 그대로 쓴다
function getArtwork(baseUrl) {
    if (!baseUrl) return []
    if (!baseUrl.includes('/50/')) return [{ src: baseUrl, sizes: '480x360', type: 'image/jpeg' }]
    return [96, 128, 192, 256, 512].map(size => ({ src: baseUrl.replace('/50/', `/${size}/`), sizes: `${size}x${size}`, type: 'image/jpeg' }))
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

        // 사용자 조작 — 한 곡 반복 중이어도 다음 곡으로 넘어간다
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
                        artwork: getArtwork(track.coverUrl),
                    });
                }
            }
        });
    }
};
