const axios = require('axios')
const db = require('../models')

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, KAKAO_CLIENT_ID, NODE_ENV } = process.env

const GOOGLE_REDIRECT_URI = NODE_ENV === 'production'
    ? 'https://dibe2.dimad.site/api/users/google/callback'
    : 'http://localhost:3000/api/users/google/callback'

    const KAKAO_REDIRECT_URI = NODE_ENV === 'production'
    ? 'https://dibe2.dimad.site/api/users/kakao/callback'
    : 'http://localhost:3000/api/users/kakao/callback'

class UserService {
    static generateState() {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    }

    static getGoogleAuthUrl(state) {
        return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(GOOGLE_REDIRECT_URI)}&response_type=code&scope=email%20profile&prompt=select_account&state=${state}`;
    }

    static async getGoogleTokens(code) {
        const response = await axios.post('https://oauth2.googleapis.com/token', {
            code,
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            redirect_uri: GOOGLE_REDIRECT_URI,
            grant_type: 'authorization_code'
        });
        return response.data;
    }

    static async getGoogleUserInfo(access_token) {
        const response = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${access_token}` }
        });
        return response.data;
    }

    static getKakaoAuthUrl(state) {
        return `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_CLIENT_ID}&redirect_uri=${encodeURIComponent(KAKAO_REDIRECT_URI)}&response_type=code&prompt=login&state=${state}`;
    }

    static async getKakaoTokens(code) {
        const response = await axios.post('https://kauth.kakao.com/oauth/token', null, {
            params: {
                grant_type: 'authorization_code',
                client_id: KAKAO_CLIENT_ID,
                redirect_uri: KAKAO_REDIRECT_URI,
                code
            }
        });
        return response.data;
    }

    static async getKakaoUserInfo(access_token) {
        const response = await axios.get('https://kapi.kakao.com/v2/user/me', {
            headers: { Authorization: `Bearer ${access_token}` }
        });
        return response.data;
    }

    static async findOrCreateUser(provider, providerId, email) {
        let user = await db.User.findOne({ provider, providerId });
        if (!user) user = await db.User.create({ provider, providerId, email })
        return user;
    }

    static async findUser({ search, page = 1, limit = 10 }) {
        const query = search
            ? { $or: [{ username: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }] }
            : {}

        const total = await db.User.countDocuments(query)
        const users = await db.User.find(query)
            .select('-password -providerId')  // 비밀번호와 providerId 제외
            .skip((page - 1) * limit)
            .limit(limit)
            .sort({ createdAt: -1 })
        return { users, total, page, totalPages: Math.ceil(total / limit) }
    }

    static async toggleAdmin(id) {
        const user = await db.User.findById(id)
        if (!user) return { success: false, message: 'User not found' }
        else {
            user.isAdmin = !user.isAdmin
            await user.save()
            return { success: true }
        } 
    }
}

module.exports = UserService