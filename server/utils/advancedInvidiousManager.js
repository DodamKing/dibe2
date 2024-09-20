const axios = require('axios')
const ytdl = require('@distube/ytdl-core')

class AdvancedInvidiousManager {
    constructor() {
        this.instances = [];
        this.lastUpdateTime = 0;
        this.updateInterval = 1000 * 60 * 60; // 1시간마다 업데이트
        this.maxRetries = 3;
        this.timeout = 15000; // 15초로 증가
        this.concurrentRequests = 3; // 동시에 요청을 보낼 인스턴스 수
    }

    async updateInstances() {
        try {
            const response = await axios.get('https://api.invidious.io/instances.json', { timeout: this.timeout });
            this.instances = response.data
                .filter(instance => instance[1].api)
                .map(instance => `https://${instance[0]}`);
        } catch (error) {
            console.error('Failed to update instances:', error.message || 'Unknown error');
        }
    }

    async getVideoInfo(videoId) {
        if (Date.now() - this.lastUpdateTime > this.updateInterval) {
            await this.updateInstances();
            this.lastUpdateTime = Date.now();
        }

        for (let attempt = 0; attempt < this.maxRetries; attempt++) {
            const shuffledInstances = this.shuffleArray([...this.instances]);
            const selectedInstances = shuffledInstances.slice(0, this.concurrentRequests);

            const requests = selectedInstances.map(instance =>
                this.makeRequest(instance, videoId)
            );

            try {
                const result = await Promise.race(requests);
                if (result) return result;
            } catch (error) {
                console.error(`All requests failed in attempt ${attempt + 1}:`, error.message || 'Unknown error');
            }

            // Wait before next attempt
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }

        throw new Error(`Failed to get video info for ${videoId} after ${this.maxRetries} attempts.`);
    }

    async makeRequest(instance, videoId) {
        try {
            const { data } = await axios.get(`${instance}/api/v1/videos/${videoId}`, {
                timeout: this.timeout,
            });
            return data;
        } catch (error) {
            console.error(`Request failed for ${instance}:`, error.message || 'Unknown error');
            return null;
        }
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    async getAudioStream(youtubeUrl) {
        try {
            const videoId = ytdl.getVideoID(youtubeUrl);
            const data = await this.getVideoInfo(videoId);

            const audioFormat = data.adaptiveFormats.find(format => format.type.startsWith('audio/'));

            if (!audioFormat) {
                throw new Error(`No audio stream found for video ${videoId}`);
            }

            // HEAD 요청으로 contentLength 확인
            let contentLength = null;
            try {
                const headResponse = await axios.head(audioFormat.url, { timeout: this.timeout });
                contentLength = headResponse.headers['content-length'];
            } catch (headError) {
                console.error('Failed to get content length:', headError.message);
            }

            // 실제 스트림 요청
            const audioStream = await axios.get(audioFormat.url, {
                responseType: 'stream',
                timeout: this.timeout,
            });

            return {
                audioStream: audioStream.data,
                duration: data.lengthSeconds,
                contentLength: contentLength || audioFormat.contentLength || null,
                mimeType: audioFormat.type
            };
        } catch (error) {
            console.error('Error in getAudioStream:', error.message || 'Unknown error');
            throw error;
        }
    }
}

module.exports = AdvancedInvidiousManager;