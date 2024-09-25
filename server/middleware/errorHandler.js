const axios = require('axios');

const formatter = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
});

export default function (req, res, next) {
    const errorTime = new Date();
    let errorHandled = false; // 중복 에러 방지 플래그

    const errorHandler = async (err) => {
        if (errorHandled) return; // 중복 호출 방지
        errorHandled = true; // 첫 호출에서 플래그 설정
        err.occurredAt = errorTime;

        try {
            if (process.env.NODE_ENV === 'development') {
                console.log('개발환경이어서 slack 메시지 안 보냄: ', err);
            } else {
                await sendErrorToSlack(err, req);
            }
        } catch (slackError) {
            console.error('Failed to send error to Slack:', slackError);
        }

        if (!res.headersSent) {
            res.status(err.statusCode || 500).json({
                message: err.message || 'An unexpected error occurred',
                ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
            });
        }
    };

    // res 객체에 errorHandler 추가
    res.errorHandler = errorHandler;

    const originalEnd = res.end;

    res.end = function (chunk, encoding) {
        if (res.statusCode >= 400 && !errorHandled) {
            const err = new Error(`HTTP Error ${res.statusCode}`);
            err.statusCode = res.statusCode;
            err.occurredAt = errorTime;
            errorHandler(err).then(() => {
                originalEnd.call(this, chunk, encoding);
            });
        } else {
            originalEnd.call(this, chunk, encoding);
        }
    };

    next();
}

async function sendErrorToSlack(err, req) {
    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;

    const message = {
        text: '🚨 서버 에러 발생',
        attachments: [
            {
                color: '#FF0000',
                fields: [
                    {
                        title: 'Error Message',
                        value: err.message,
                        short: false,
                    },
                    {
                        title: 'Time (KST)',
                        value: formatter.format(err.occurredAt),
                        short: false,
                    },
                    {
                        title: 'Request URL',
                        value: req.originalUrl,
                        short: false,
                    },
                    {
                        title: 'Request Method',
                        value: req.method,
                        short: false,
                    },
                    {
                        title: 'User Agent',
                        value: req.headers['user-agent'],
                        short: false,
                    },
                ],
            },
        ],
    };

    if (err.stack) {
        message.attachments[0].fields.push({
            title: 'Stack Trace',
            value: err.stack.split('\n').slice(0, 5).join('\n'), // 첫 5줄만 포함
            short: false,
        });
    }

    try {
        await axios.post(slackWebhookUrl, message);
    } catch (error) {
        console.error('Error sending message to Slack:', error);
    }
}
