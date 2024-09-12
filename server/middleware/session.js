const express = require('express')
const session = require('express-session')
const MongoStore = require('connect-mongo')

// require('dotenv').config()

const app = express()

// app.set('trust proxy', 1)

app.use(session({
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
        secure: false,
        httpOnly: true,
    }
}))

app.use((req, res, next) => {
    console.log('secret:', process.env.SESSION_SECRET);
    console.log('db:', process.env.MONGODB_URI);
    console.log('env:', process.env.NODE_ENV);
    next()
})

module.exports = app
