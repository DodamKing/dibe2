const express = require('express')
const router = express.Router()

router.get('/test/msg', (req, res) => {
    const msg = 'hello from the server! change!!! hihi'
    res.json({ msg })
})

module.exports = router