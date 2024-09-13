// const express = require('express')
// const session = require('express-session')
// const MongoStore = require('connect-mongo')

// const app = express()

// const isProduction = process.env.NODE_ENV === 'production'

// if (isProduction) app.set('trust proxy', 1)

// const store = MongoStore.create({
//     mongoUrl: process.env.MONGODB_URI,
//     dbName: 'dibe2',
//     collectionName: 'sessions',
//     ttl: 24 * 60 * 60,
//     autoRemove: 'native',
//     touchAfter: 24 * 3600 // 24시간마다 세션 갱신
// })

// store.on('error', function(err) {
//     console.error('MongoStore 에러:', err)
// })

// app.use(session({
//     secret: process.env.SESSION_SECRET || 'dibe2_secret',
//     resave: false,
//     saveUninitialized: false,
//     store: store,
//     cookie: {
//         secure: isProduction,
//         httpOnly: true,
//         maxAge: 24 * 60 * 60 * 1000,
//         sameSite: isProduction ? 'none' : 'lax'
//     },
//     name: 'dibe2_session_cookie'
// }))

// module.exports = app

import session from 'express-session'
import MongoStore from 'connect-mongo'

export default function (req, res, next) {
    if (!req.session) {
        session({
            secret: process.env.SESSION_SECRET || 'dibe2_secret',
            resave: false,
            saveUninitialized: false,
            store: MongoStore.create({
                mongoUrl: process.env.MONGODB_URI,
                dbName: 'dibe2',
                collectionName: 'sessions',
                ttl: 24 * 60 * 60,
                autoRemove: 'native',
                touchAfter: 24 * 3600 // 24시간마다 세션 갱신
            }),
            cookie: {
                secure: process.env.NODE_ENV === 'production',
                httpOnly: true,
                maxAge: 24 * 60 * 60 * 1000,
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
            },
            name: 'dibe2_session_cookie'
        })(req, res, next)
    } else {
        next()
    }
}
