/**
 * users.email 의 unique 인덱스를 일반 인덱스로 바꾼다 (2026-11-08, 한 번 실행).
 * 소셜 로그인만 쓰는데 이메일 unique 가 남아 있어 ① 같은 이메일로 다른 방식 가입이 실패하고
 * ② 이메일 없는 계정은 DB 전체에 하나만 가능했다. 상세는 docs/DATA_MODELS.md User
 *
 *   node scripts/drop-email-unique.js            # 현재 인덱스만 출력
 *   node scripts/drop-email-unique.js --apply    # 바꾼다
 *
 * ⚠️ 되돌리기: 같은 이메일 계정이 생긴 뒤엔 unique 로 다시 못 만든다
 */
require('dotenv').config()
const mongoose = require('mongoose')
const { connectToMongoDB, User } = require('../server/models')

async function main() {
    await connectToMongoDB()
    const show = async (label) => console.log(label, JSON.stringify((await User.collection.indexes()).map((i) => ({ name: i.name, key: i.key, unique: !!i.unique }))))
    await show('지금:')
    if (!process.argv.includes('--apply')) return console.log('--apply 없이 실행 — 바꾸지 않음')

    const idx = (await User.collection.indexes()).find((i) => i.name === 'email_1')
    if (idx && idx.unique) {
        await User.collection.dropIndex('email_1')
        console.log('email_1(unique) 삭제')
    }
    await User.collection.createIndex({ email: 1 }, { name: 'email_1' })
    await show('바꾼 뒤:')
}

main()
    .catch((err) => { console.error(err); process.exitCode = 1 })
    .finally(() => mongoose.disconnect())
