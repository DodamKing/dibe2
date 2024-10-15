const express = require('express')
const router = express.Router()
const services = require('../services')

router.get('/user-stats', async (req, res) => {
    try {
        const userStats = await services.adminService.getUserStats()
        res.json(userStats)
    } catch (error) {
        console.error('Error fetching user-stats:', error)
        res.status(500).json({ error: 'Internal Server Error' })
    }
})

router.get('/visitor-stats', async (req, res) => {
    try {
        const visitorStats = await services.adminService.getVisitorStats()
        res.json(visitorStats)
    } catch (error) {
        console.error('Error fetching visitor-stats:', error)
        res.status(500).json({ error: 'Internal Server Error' })
    }
})

router.get('/system-stats', async (req, res) => {
    try {
        const [stats, uptime] = await Promise.all([
            services.adminService.getSystemStats(),
            services.adminService.getAppUptime()
        ]);

        res.json({
            ...stats,
            uptime: uptime
        });
    } catch (error) {
        console.error('Error getting system stats:', error);
        res.status(500).json({ error: 'Failed to get system stats' });
    }
})

module.exports = router