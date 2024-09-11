module.exports = {
    apps: [{
        name: 'nuxt-app',
        script: 'npm',
        args: 'start',
        log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        out_file: 'logs/out.log',
        error_file: 'logs/error.log',
        merge_logs: true,
        log_type: 'json'
    }]
};

// 우선 만들어 봄