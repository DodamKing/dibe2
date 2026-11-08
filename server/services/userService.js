const axios = require('axios')
const db = require('../models')

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, KAKAO_CLIENT_ID, BASE_URL } = process.env

const baseUrl = BASE_URL || 'http://localhost:8888'
const GOOGLE_REDIRECT_URI = `${baseUrl}/api/users/google/callback`
const KAKAO_REDIRECT_URI = `${baseUrl}/api/users/kakao/callback`

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

    /**
     * 소셜 로그인 계정 찾기/만들기 + 로그인할 때마다 이름·이메일을 최신으로 (2026-11-08).
     * - 사람 구분은 provider + providerId(구글·카카오가 보장). 이메일은 사용자를 알아보는 정보일 뿐이라
     *   **중복을 막지 않는다** — 같은 이메일로 카카오·구글 각각 가입하면 별개 계정(사용자 결정)
     * - **새 가입은 이메일 필수** — 없으면 EMAIL_REQUIRED 에러(호출부가 안내). 카카오 콘솔 "이메일 필수 동의"와 이중으로 막는다.
     *   기존 계정은 이메일이 없어도 로그인된다(2024-10-02 이전 가입 구글 계정)
     * - 예전엔 가입 때 이메일만 저장하고 이름은 토큰에만 넣었다 → 관리자 화면에 이름이 없었다
     */
    static async findOrCreateUser(provider, providerId, email, name) {
        let user = await db.User.findOne({ provider, providerId });
        if (!user) {
            if (!email) {
                const err = new Error('이메일 제공에 동의해야 가입할 수 있어요.')
                err.code = 'EMAIL_REQUIRED'
                throw err
            }
            return db.User.create({ provider, providerId, email, username: name || undefined })
        }
        const set = {}
        if (name && user.username !== name) set.username = name
        if (email && user.email !== email) set.email = email
        if (Object.keys(set).length) {
            try {
                user = await db.User.findByIdAndUpdate(user._id, { $set: set }, { new: true })
            } catch (err) {
                console.error('로그인 시 이름·이메일 갱신 실패(로그인은 계속):', err.message)
            }
        }
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

    static async checkAccess(userId) {
        const user = await db.User.findById(userId)
        return user.canAccess()
    }
}

module.exports = UserService