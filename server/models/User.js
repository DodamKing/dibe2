const mongoose = require('mongoose')
const bcrypt = require('bcryptjs')

const userSchema = new mongoose.Schema({
    username: String,
    // unique 아님(2026-11-08) — 사람 구분은 provider + providerId. 같은 이메일로 카카오·구글 각각 가입하면 별개 계정.
    // 예전 unique 는 이메일이 로그인 아이디였던 아이디·비밀번호 가입의 흔적이라, 소셜 로그인에선 같은 이메일 재가입과
    // "이메일 없는 계정은 하나만"이 깨졌다. 운영 DB 인덱스도 scripts/drop-email-unique.js 로 바꿨다
    email: { type: String, index: true },
    password: String,
    provider: { type: String, enum: ['google', 'kakao'] },
    providerId: String,
    isAdmin: { type: Boolean, default: false },
    expiryDate: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) },
}, {
    timestamps: true
})

userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next()
    if (!this.password) return next()

    const salt = await bcrypt.genSalt(10)
    this.password = await bcrypt.hash(this.password, salt)
    next()
})

userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password)
}

// 접근 권한 확인 - 단순히 날짜만 체크
userSchema.methods.canAccess = function () {
    if (!this.expiryDate) return false  // 미승인 상태
    return new Date() <= this.expiryDate
}

module.exports = mongoose.model('User', userSchema)