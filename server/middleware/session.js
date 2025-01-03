import session from 'express-session'
import MongoStore from 'connect-mongo'

const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET || 'dibe2_secret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        dbName: 'dibe2',
        collectionName: 'sessions',
        ttl: 24 * 60 * 60,
        autoRemove: 'native',
        touchAfter: 24 * 3600
    }),
    cookie: {
        // secure: process.env.NODE_ENV === 'production',
        secure: false, // http 사용시 반드시 false, true로 하면 쿠키 전송이 안됨
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
        // sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
        sameSite: 'lax' // 이것도 lax로 고정해보자자
    },
    name: 'dibe2_session_cookie'
})

export default function (req, res, next) {
    if (!req.session) {
        sessionMiddleware(req, res, next)
    } else {
        next()
    }
}
