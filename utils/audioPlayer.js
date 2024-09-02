class AudioPlayerService {
    constructor() {
        this.audio = null;
        this.currentUrl = null;
        this.onTrackEndedCallback = null;
        this.onTimeUpdateCallback = null;
        this.duration = 0;
        this.cache = new Map();
    }

    init() {
        // if (typeof window !== 'undefined' && !this.audio) {
        //     this.audio = new Audio();
        //     this.audio.addEventListener('ended', this.onTrackEnded.bind(this));
        //     this.audio.addEventListener('timeupdate', this.onTimeUpdate.bind(this));
        // }
        if (typeof window !== 'undefined' && !this.audio) {
            this.audio = new Audio();
            this.audio.addEventListener('ended', this.onTrackEnded.bind(this));
            this.audio.addEventListener('timeupdate', this.onTimeUpdate.bind(this));
            this.audio.addEventListener('loadedmetadata', () => {
                if (this.audio.duration === Infinity) {
                    this.audio.currentTime = 1e101;
                    this.audio.addEventListener('timeupdate', () => {
                        if (this.audio.currentTime > 0) {
                            this.duration = this.audio.duration;
                            this.updateCache(this.currentUrl, this.duration);
                            this.audio.currentTime = 0;
                        }
                    }, { once: true });
                } else {
                    this.duration = this.audio.duration;
                    this.updateCache(this.currentUrl, this.duration);
                }
            });
            this.audio.addEventListener('durationchange', () => {
                if (this.audio.duration !== Infinity) {
                    this.duration = this.audio.duration;
                    this.updateCache(this.currentUrl, this.duration);
                }
            });
        }
    }

    play(url) {
        if (!this.audio) this.init();
        if (this.audio) {
            if (url && url !== this.currentUrl) {
                if (this.cache.has(url)) {
                    this.duration = this.cache.get(url).duration;
                } else {
                    this.duration = 0; // 새로운 URL이면 duration 초기화
                }

                this.audio.src = url;
                this.currentUrl = url;
            }
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

    updateCache(url, duration) {
        if (url) {
            this.cache.set(url, { duration });
        }
    }
}

export default new AudioPlayerService();