const express = require('express')
const bcrypt = require('bcrypt')
const db = require('../models')

const router = express.Router()

router.get('/test/msg', (req, res) => {
    const msg = 'hello from the server! change!!! hihi'
    res.json({ msg })
})

router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body

        const existingUser = await db.User.findOne({ email })
        if (existingUser) return res.status(500).json({ message: '이미 사용 중인 이메일입니다.'})

        const saltRounds = 10
        const hashedPassword = await bcrypt.hash(password, saltRounds)

        const newUser = new User({
            username,
            email,
            password: hashedPassword
        })

        await newUser.save()

        res.status(201).json({ message: '회원가입이 완료되었습니다.'})
    } catch (err) {
        console.error('회원가입 에러:', err)
        res.status(500).json({ message: '서버 오류가 발생했습니다.'})
    }
})

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body
        const user = await db.User.findOne({ email })

        if (!user) return res.status(400).json({ message: '사용자를 찾을 수 없습니다.'})
        
        const isMatch = await bcrypt.compare(password, user.password)
        if (!isMatch) return res.status(400).json({ message: '비밀번호가 일치하지 않습니다.'})

        res.json({ message: '로그인 성공', user: { id: user._id, username: user.username, email: user.email }})
    } catch (err) {
        console.error('로그인 에러', err)
        res.status(500).json({ message: '서버 오류가 발생했습니다.'})
    }
})

module.exports = router