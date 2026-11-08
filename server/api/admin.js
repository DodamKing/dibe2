const express = require('express')
const router = express.Router()
const services = require('../services')

// 대시보드 한 번에 (크론·음원·테마·사용자·이용). 예전 user-stats·visitor-stats·music-stats 를 합쳤다(2026-11-08)
router.get('/dashboard', async (req, res) => {
    try {
        res.json(await services.adminService.getDashboard())
    } catch (error) {
        console.error('Error fetching dashboard:', error)
        res.status(500).json({ error: 'Internal Server Error' })
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