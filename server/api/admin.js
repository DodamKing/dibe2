const express = require('express')
const router = express.Router()

router.get('/dashboard', (req, res) => {
    res.json({
        totalUsers: 1000,
        activeUsers: 750,
        totalRevenue: 50000
    })
})

module.exports = router