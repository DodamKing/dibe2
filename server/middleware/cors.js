const cors = require('cors')

const corsOptions = {
    origin: process.env.SITE_URL || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
}

module.exports = cors(corsOptions)
