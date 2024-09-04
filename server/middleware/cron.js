const cron = require('node-cron')
const helper = require('../utils/helper')
const { songService } = require('../services')

function setupCronJob(schedule, jobName, task) {
    if (!global.cronJobsRegistered) global.cronJobsRegistered = {};
    
    if (!global.cronJobsRegistered[jobName]) {
        cron.schedule(schedule, async () => {
            console.log(`${jobName} 시작: ${new Date().toISOString()}`);
            try {
                await task();
                console.log(`${jobName} 완료: ${new Date().toISOString()}`);
            } catch (error) {
                console.error(`${jobName} 실행 중 오류 발생:`, error);
                // 여기에 오류 보고 로직 추가 (예: 이메일 알림, 로그 시스템 등)
            }
        });
        global.cronJobsRegistered[jobName] = true;
    }
}

module.exports = function (req, res, next) {
    // 차트 데이터 가져오기 및 저장 (매일 9시)
    setupCronJob('0 9 * * *', 'updateChartData', async () => {
        const chartData = await helper.getBugsChart();
        await songService.saveSongData(chartData);
        await songService.updateChartData(chartData);
    });

    // 가사 업데이트 (매일 새벽 2시)
    setupCronJob('0 2 * * *', 'updateLyrics', async () => {
        await songService.updateLyrics();
    });

    // YouTube URL 업데이트 (매일 새벽 3시)
    setupCronJob('0 3 * * *', 'updateYoutubeUrls', async () => {
        await songService.updateYoutubeUrls();
    });

    next();
};