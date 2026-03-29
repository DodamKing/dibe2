const cors = require('cors')

const corsOptions = {
    origin: process.env.SITE_URL || 'https://dibe2.dimad.site',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
}

module.exports = cors(corsOptions)
