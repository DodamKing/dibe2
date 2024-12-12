const mongoose = require('mongoose')
const bcrypt = require('bcrypt')

const userSchema = new mongoose.Schema({
    username: String,
    email: { type: String, unique: true },
    password: String,
    provider: { type: String, enum: ['google', 'kakao'] },
    providerId: String,
    isAdmin: { type: Boolean, default: false },
    expiryDate: { type: Date, default: null },
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