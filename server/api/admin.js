const express = require('express')
const router = express.Router()
const songService = require('../services/songService')

router.get('/dashboard', (req, res) => {
    res.json({
        totalUsers: 1000,
        activeUsers: 750,
        totalRevenue: 50000
    })
})

module.exports = router