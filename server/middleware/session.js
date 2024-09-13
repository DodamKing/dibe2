const express = require('express')
const session = require('express-session')
const MongoStore = require('connect-mongo')

const app = express()

const isProduction = process.env.NODE_ENV === 'production'

if (isProduction) app.set('trust proxy', 1)

const store = MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    dbName: 'dibe2',
    collectionName: 'sessions',
    ttl: 24 * 60 * 60,
    autoRemove: 'native',
    touchAfter: 24 * 3600 // 24시간마다 세션 갱신
})

store.on('error', function(err) {
    console.error('MongoStore 에러:', err)
})

app.use(session({
    secret: process.env.SESSION_SECRET || 'dibe2_secret',
    resave: false,
    saveUninitialized: false,
    store: store,
    cookie: {
        secure: isProduction,
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        sameSite: isProduction ? 'none' : 'lax'
    },
    name: 'dibe2_session_cookie'
}))

// 세션 디버깅 미들웨어
app.use((req, res, next) => {
    console.log('Session ID:', req.sessionID);
    console.log('Session:', req.session);
    console.log('Cookies:', req.headers.cookie);
    next();
});

module.exports = app
