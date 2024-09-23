// utils/youtubePlayer.js
// import { updateMediaSession } from '@/store/player';

let player = null;
let isAPIReady = false;
let onReadyCallback;
let onStateChangeCallback;
let onErrorCallback;
let currentVideoId = null;

function onYouTubeIframeAPIReady() {
    isAPIReady = true;
    initPlayer();
}

function initPlayer() {
    if (!isAPIReady) return;

    player = new YT.Player('youtube-player', {
        height: '0',
        width: '0',
        playerVars: {
            'autoplay': 0,
            'controls': 0,
            'disablekb': 1,
            'iv_load_policy': 3,
            'modestbranding': 1,
            'rel': 0,
            'showinfo': 0,
            'enablejsapi': 1,
            'origin': window.location.origin,
            'playsinline': 1,
            'fs': 0,
            'hl': 'ko',
            'widget_referrer': window.location.origin,
        },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange,
            'onError': onPlayerError
        }
    });
}

function onPlayerReady(event) {
    if (onReadyCallback) onReadyCallback(event);
}

function onPlayerStateChange(event) {
    if (onStateChangeCallback) onStateChangeCallback(event);

    // updateMediaSession()
}

function onPlayerError(event) {
    console.error('YouTube player error:', event.data);
    if (onErrorCallback) onErrorCallback(event);
}

export default {
    init(readyCallback, stateChangeCallback, errorCallback) {
        onReadyCallback = readyCallback;
        onStateChangeCallback = stateChangeCallback;
        onErrorCallback = errorCallback;

        if (typeof YT === 'undefined' || !YT.Player) {
            const tag = document.createElement('script');
            tag.src = "https://www.youtube.com/iframe_api";
            const firstScriptTag = document.getElementsByTagName('script')[0];
            firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

            window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;
        } else {
            isAPIReady = true;
            initPlayer();
        }
    },

    getCurrentVideoId() {
        return currentVideoId;
    },

    loadVideo(videoId) {
        if (player && player.loadVideoById) {
            player.loadVideoById(videoId);
            currentVideoId = videoId;
        } else {
            console.warn('YouTube player not ready. Video will be loaded when player is ready.');
            currentVideoId = videoId;
        }
    },

    play() {
        if (player && player.playVideo) {
            player.playVideo();
        }
    },

    pause() {
        if (player && player.pauseVideo) {
            player.pauseVideo();
        }
    },

    stop() {
        if (player && player.stopVideo) {
            player.stopVideo();
        }
    },

    seek(seconds) {
        if (player && player.seekTo) {
            player.seekTo(seconds, true);
        }
    },

    setVolume(volume) {
        if (player && player.setVolume) {
            player.setVolume(volume * 100);
        }
    },

    getCurrentTime() {
        return player && player.getCurrentTime ? player.getCurrentTime() : 0;
    },

    getDuration() {
        return player && player.getDuration ? player.getDuration() : 0;
    },

    getPlayer() {
        return player;
    },

    getPlayerState() {
        return player && player.getPlayerState ? player.getPlayerState() : null;
    },

    getPlaybackRate() {
        return player && player.getPlaybackRate ? player.getPlaybackRate() : 1;
    },

    isReady() {
        return !!player && typeof player.getPlayerState === 'function';
    }
};