const express = require('express')
const session = require('express-session')
const MongoStore = require('connect-mongo')

const app = express()

app.set('trust proxy', 1)

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
        secure: process.env.NODE_ENV === 'production',
        domain: process.env.NODE_ENV === 'production' ? '.dibe2.dimad.site' : undefined,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        httpOnly: true,
    }
}))

app.use((req, res, next) => {
    console.log('Request headers:', req.headers);
    console.log('Session:', req.session);

    const oldWriteHead = res.writeHead;
    res.writeHead = function (statusCode, headers) {
        console.log('Response headers:', this.getHeaders());
        oldWriteHead.apply(this, arguments);
    };

    next();
});

module.exports = app
