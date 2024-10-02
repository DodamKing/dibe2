const mongoose = require('mongoose')
const bcrypt = require('bcrypt')

const userSchema = new mongoose.Schema({
    username: String,
    email: { type: String, unique: true },
    password: String,
    provider: { type: String, enum: ['google', 'kakao'] },
    providerId: String,
    isAdmin: { type: Boolean, default: false }
})

userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next()
    this.password = await bcrypt.hash(this.password, 10)
    next()
})

userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password)
}

module.exports = mongoose.model('User', userSchema)