const cron = require('node-cron')
const helper = require('../utils/helper')
const { songService } = require('../services')
const { sendErrorToSlack } = require('../utils/helper')
const { connectToMongoDB } = require('../models')

function setupCronJob(schedule, jobName, task) {
    if (process.env.NODE_ENV !== 'development') {
        if (!global.cronJobsRegistered) global.cronJobsRegistered = {};
        
        if (!global.cronJobsRegistered[jobName]) {
            cron.schedule(schedule, async () => {
                console.log(`${jobName} 시작: ${new Date().toISOString()}`);
                try {
                    await connectToMongoDB()
                    await task();
                    console.log(`${jobName} 완료: ${new Date().toISOString()}`);
                } catch (error) {
                    console.error(`${jobName} 실행 중 오류 발생:`, error);
                    sendErrorToSlack(error, null, {
                        context: 'Cron Job',
                        jobName,
                        schedule,
                        scheduledTime: new Date().toISOString() 
                    })
                }
            });
            global.cronJobsRegistered[jobName] = true;
            console.log(`크론 작업 등록됨: ${jobName}`);
        }
    }
}

function setupAllCronJobs() {
    if (!global.cronJobsSetup) {
        // 차트 데이터 가져오기 및 저장 (매일 8시)
        setupCronJob('0 8 * * *', 'updateChartData', async () => {
            const chartData = await helper.getBugsChart();
            await songService.saveSongData(chartData);
            await songService.updateChartData(chartData);
        });
        
        // YouTube URL 업데이트 (매일 8시 10분)
        setupCronJob('10 8 * * *', 'updateYoutubeUrls', async () => {
            await songService.updateYoutubeUrls();
        });

        // 가사 업데이트 (매일 새벽 2시)
        setupCronJob('0 2 * * *', 'updateLyrics', async () => {
            await songService.updateLyrics();
        });

        global.cronJobsSetup = true;

        if (process.env.NODE_ENV === 'development') {
            console.log('개발 모드: 모든 크론 작업이 비활성화되었습니다.');
        } else {
            console.log('프로덕션 모드: 모든 크론 작업이 설정되었습니다.');
        }
    }
}

try {
    setupAllCronJobs();
} catch (error) {
    console.error('크론 작업 등록 중 오류 발생:', error);
}

module.exports = function (req, res, next) {
    next();
};