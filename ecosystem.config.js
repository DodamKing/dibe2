module.exports = {
    apps: [{
        name: 'dibe2',
        script: 'npm',
        args: 'start',
        env: {
            TZ: 'Asia/Seoul'
        },
        log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        output: './logs/out.log',
        error: './logs/error.log',
        log_file: './logs/combined.log',
        time: true,
        restart_delay: 3000,  // 3초 대기 후 재시작
        max_restarts: 10,     // 최대 10번 재시작 시도
        cron_restart: '0 4 * * *',  // 4시 재시작
        max_memory_restart: '1G'  // 메모리 사용량이 1GB를 초과하면 재시작
    }]
};