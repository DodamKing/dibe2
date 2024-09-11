module.exports = {
    apps: [{
        name: 'dibe2',
        script: 'npm',
        args: 'start',
        env: {
            TZ: 'Asia/Seoul'
        },
        log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        // output: './logs/out.log',
        // error: './logs/error.log',
        // log_file: './logs/combined.log',
        // time: true,
        // merge_logs: true,
        // log_type: 'raw'
    }]
};