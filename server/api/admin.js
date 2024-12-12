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

router.put('/users/:userId/access', async (req, res) => {
    try {
        const { userId } = req.params
        const { days } = req.body

        if (!days) return res.status(400).json({ message: '사용 기간을 지정해주세요.' })

        if (days !== 'unlimited' && (!Number.isInteger(days) || days < 1)) return res.status(400).json({ message: '유효한 기간을 입력해주세요.' })

        const updateUser = await services.adminService.setUserAccessPeriod(userId, days)

        if (!updateUser) return res.status(404).json({ message: '사용자를 찾을 수 없습니다.' })

        res.json({ message: '사용 기간이 성공적으로 설정되었습니다.', user: updateUser })
    } catch (error) {
        console.error('Error setting user access period:', error)
        res.status(500).json({ message: '사용 기간 설정 중 오류가 발생했습니다.' })
    }
})

module.exports = router