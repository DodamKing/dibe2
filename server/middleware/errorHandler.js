const axios = require('axios')

const formatter = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
});

export default function (req, res, next) {
    const errorTime = new Date()

    const errorHandler = async (err) => {
        err.occurredAt = errorTime

        try {
            if (process.env.NODE_ENV === 'development') return console.log('개발환경이어서 slack 메시지 안 보냄.')
            await sendErrorToSlack(err, req);
        } catch (slackError) {
            console.error('Failed to send error to Slack:', slackError);
        }

        // 에러 응답이 이미 전송되었는지 확인
        if (!res.headersSent) {
            res.status(err.statusCode || 500).json({
                message: err.message || 'An unexpected error occurred',
                ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
            });
        }
    };

    // res 객체에 errorHandler 추가
    res.errorHandler = errorHandler;

    const originalEnd = res.end;

    // res.end를 래핑
    res.end = function (chunk, encoding) {
        originalEnd.call(this, chunk, encoding);

        // 상태 코드가 400 이상인 경우에도 에러 핸들러 호출
        if (res.statusCode >= 400) {
            const err = new Error(`HTTP Error ${res.statusCode}`);
            err.statusCode = res.statusCode;
            err.occurredAt = errorTime
            errorHandler(err);
        }
    };

    next();
}

async function sendErrorToSlack(err, req) {
    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;

    const message = {
        text: '🚨 서버 에러 발생',
        attachments: [{
            color: '#FF0000',
            fields: [
                {
                    title: 'Error Message',
                    value: err.message,
                    short: false
                },
                {
                    title: 'Time (KST)',
                    value: formatter.format(err.occurredAt),
                    short: false
                },
                {
                    title: 'Request URL',
                    value: req.originalUrl,
                    short: false
                },
                {
                    title: 'Request Method',
                    value: req.method,
                    short: false
                },
                {
                    title: 'User Agent',
                    value: req.headers['user-agent'],
                    short: false
                },
            ]
        }]
    };

    // 스택 트레이스가 있다면 포함
    if (err.stack) {
        message.attachments[0].fields.push({
            title: 'Stack Trace',
            value: err.stack.split('\n').slice(0, 5).join('\n'), // 첫 5줄만 포함
            short: false
        });
    }

    try {
        await axios.post(slackWebhookUrl, message);
    } catch (error) {
        console.error('Error sending message to Slack:', error);
    }
}