const express = require('express')
const session = require('express-session')

const app = express()

app.use(session({
    secret: 'dibe2_secret',
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000
    }
}))

app.use((req, res, next) => {
    if (process.env.NODE_ENV === 'development' && !req.session.user) {
        req.session.user = {
            userId: '66d66cca82defc51c7c1ce1f',
            username: 'tester1',
            email: 'user1@test.com'
        }
        console.log('개발 모드: 세션에 개발자 정보 자동 설정됨')
    }
    next()
})

module.exports = app