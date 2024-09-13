const express = require('express')
const session = require('express-session')
const MongoStore = require('connect-mongo')

const app = express()

const isProduction = process.env.NODE_ENV === 'production'
if (isProduction) app.enable('trust proxy')

app.use(session({
    secure: isProduction,
    secret: process.env.SESSION_SECRET || 'dibe2_secret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        dbName: 'dibe2',
        collectionName: 'sessions',
        ttl: 24 * 60 * 60
    }),
    cookie: {
        maxAge: 24 * 60 * 60 * 1000,
        secure: isProduction,
        httpOnly: true,
        sameSite: isProduction ? 'none' : 'lax',
    },
    name: 'dibe2-session-cookie'
}))

module.exports = app
