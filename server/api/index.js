const express = require('express')
require('dotenv').config()
require('../models')
const session = require('express-session')
const { sessionCheckMiddleware } = require('../middleware/auth')

const app = express()

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use(session({
    secret: 'dibe2_secret',
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000
    }
}))

app.use(sessionCheckMiddleware)

const userRoutes = require('./user')

app.use('/users', userRoutes)

module.exports  = app

