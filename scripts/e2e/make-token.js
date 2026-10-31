// 로컬 브라우저 검증(Playwright)용 로그인 토큰 — 관리자 계정으로 1일짜리 JWT 를 만들어 stdout 에 찍는다.
// 소셜 로그인만 열려 있어 자동화가 로그인 화면을 못 넘기기 때문. 토큰은 파일로 저장하지 말고 파이프로만 넘긴다.
//   node scripts/e2e/make-token.js            → 첫 관리자
//   node scripts/e2e/make-token.js <email>    → 그 계정
require('dotenv').config()
const mongoose = require('mongoose')
const db = require('../../server/models')
const { generateToken } = require('../../server/middleware/auth')

async function main() {
    await db.connectToMongoDB()
    const email = process.argv[2]
    const user = await db.User.findOne(email ? { email } : { isAdmin: true }).lean()
    if (!user) throw new Error('계정을 찾지 못했어요')
    const token = generateToken({
        userId: user._id,
        email: user.email,
        name: user.name || user.username || 'e2e',
        provider: user.provider,
        isAdmin: user.isAdmin,
        expiryDate: user.expiryDate,
    }, '1d')
    process.stdout.write(token)
}

main()
    .catch(err => { console.error(err.message); process.exitCode = 1 })
    .finally(() => mongoose.disconnect())
