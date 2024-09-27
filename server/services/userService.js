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
        return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(GOOGLE_REDIRECT_URI)}&response_type=code&scope=email%20profile&state=${state}`;
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
        return `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_CLIENT_ID}&redirect_uri=${encodeURIComponent(KAKAO_REDIRECT_URI)}&response_type=code&state=${state}`;
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

    static async findOrCreateUser(provider, providerId) {
        let user = await db.User.findOne({ provider, providerId });
        if (!user) user = await db.User.create({ provider, providerId })
        return user;
    }
}

module.exports = UserService