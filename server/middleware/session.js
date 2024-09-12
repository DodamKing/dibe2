const express = require('express')
const session = require('express-session')
const MongoStore = require('connect-mongo')

const app = express()

app.use(session({
    secret: process.env.SESSION_SECRET || 'dibe2_secret',
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        dbName: 'dibe2',
        collectionName: 'sessions',
        ttl: 24 * 60 * 60
    }),
    cookie: {
        maxAge: 24 * 60 * 60 * 1000,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        httpOnly: true,
    }
}))

// app.use((req, res, next) => {
//     if (process.env.NODE_ENV === 'development' && !req.session.user) {
//         req.session.user = {
//             userId: '66d66cca82defc51c7c1ce1f',
//             username: 'tester1',
//             email: 'user1@test.com'
//         }
//         console.log('개발 모드: 세션에 개발자 정보 자동 설정됨')
//     }
//     next()
// })

module.exports = app
