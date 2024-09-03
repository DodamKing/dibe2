const express = require('express')
require('dotenv').config()
require('../models')
const { sessionCheckMiddleware } = require('../middleware/auth')

const app = express()

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use(sessionCheckMiddleware)

const userRoutes = require('./user')
const songRoutes = require('./song')
const playlistRoutes = require('./playlist')

app.use('/users', userRoutes)
app.use('/songs', songRoutes)
app.use('/playlists', playlistRoutes)

module.exports  = app

