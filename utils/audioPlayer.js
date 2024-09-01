class AudioPlayerService {
    constructor() {
        this.audio = null;
        this.onTrackEndedCallback = null;
        this.onTimeUpdateCallback = null;
    }

    init() {
        if (typeof window !== 'undefined' && !this.audio) {
            this.audio = new Audio();
            this.audio.addEventListener('ended', this.onTrackEnded.bind(this));
            this.audio.addEventListener('timeupdate', this.onTimeUpdate.bind(this));
        }
    }

    play(url) {
        if (!this.audio) this.init();
        if (this.audio) {
            this.audio.src = url;
            return this.audio.play();
        }
        return Promise.resolve(); // 서버 사이드에서는 아무것도 하지 않음
    }

    pause() {
        if (this.audio) {
            this.audio.pause();
        }
    }

    setVolume(volume) {
        if (this.audio) {
            this.audio.volume = volume;
        }
    }

    seek(time) {
        if (this.audio) {
            this.audio.currentTime = time;
        }
    }

    setOnTrackEndedCallback(callback) {
        this.onTrackEndedCallback = callback;
    }

    setOnTimeUpdateCallback(callback) {
        this.onTimeUpdateCallback = callback;
    }

    onTrackEnded() {
        if (this.onTrackEndedCallback) {
            this.onTrackEndedCallback();
        }
    }

    onTimeUpdate() {
        if (this.onTimeUpdateCallback && this.audio) {
            this.onTimeUpdateCallback(this.audio.currentTime, this.audio.duration);
        }
    }
}

export default new AudioPlayerService();