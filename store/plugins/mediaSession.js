// store/plugins/mediaSession.js
import youtubePlayer from '@/utils/youtubePlayer';

function getAlbumCoverUrl(baseUrl, size) {
    return baseUrl.replace('/50/', `/${size}/`);
}

export const mediaSessionPlugin = (store) => {
    if (process.client && 'mediaSession' in navigator) {
        let lastPlaybackState = null;

        const updateMediaSession = () => {
            const track = store.state.player.currentTrack;
            const player = youtubePlayer.getPlayer();
            
            if (track && player) {
                const playerState = youtubePlayer.getPlayerState();
                const isPlaying = playerState === YT.PlayerState.PLAYING;
                
                // 재생 상태가 변경되었을 때만 업데이트
                if (isPlaying !== lastPlaybackState) {
                    lastPlaybackState = isPlaying;
                    
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

                    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
                }

                navigator.mediaSession.setPositionState({
                    duration: player.getDuration(),
                    playbackRate: player.getPlaybackRate(),
                    position: player.getCurrentTime()
                });
            }
        };

        // Media Session API 핸들러 설정
        navigator.mediaSession.setActionHandler('play', () => {
            if (youtubePlayer.isReady()) {
                youtubePlayer.play();
                store.commit('player/SET_PLAYING', true);
            }
        });

        navigator.mediaSession.setActionHandler('pause', () => {
            youtubePlayer.getPlayer().pauseVideo();
            store.commit('player/SET_PLAYING', false);
        });

        navigator.mediaSession.setActionHandler('previoustrack', () => {
            store.dispatch('player/playPrevious');
        });

        navigator.mediaSession.setActionHandler('nexttrack', () => {
            store.dispatch('player/playNext');
        });

        // 주기적으로 상태 확인 및 업데이트
        setInterval(updateMediaSession, 1000);

        // 트랙 변경 시 강제 업데이트
        store.subscribe((mutation, state) => {
            if (mutation.type === 'player/SET_CURRENT_TRACK') {
                lastPlaybackState = null; // 강제로 업데이트하도록 상태 리셋
                updateMediaSession();
            }
        });
    }
};