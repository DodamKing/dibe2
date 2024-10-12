module.exports = {
    apps: [{
        name: 'dibe2',
        script: 'npm',
        args: 'start',
        // env: {
        //     TZ: 'Asia/Seoul'
        // },
        // log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        output: './logs/out.log',
        error: './logs/error.log',
        max_memory_restart: '1G'  // 메모리 사용량이 1GB를 초과하면 재시작
    }]
};