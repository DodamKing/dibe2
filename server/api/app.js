const express = require('express')
const axios = require('axios')

const router = express.Router()

// APK는 private 저장소(dibe2-app)의 GitHub Releases 자산으로 배포한다.
// 앱/웹은 이 라우터를 통해서만 접근 → 전역 jwtCheckMiddleware로 로그인 게이팅.
const GITHUB_OWNER = process.env.APP_RELEASE_OWNER || 'DodamKing'
const GITHUB_REPO = process.env.APP_RELEASE_REPO || 'dibe2-app'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN

const gh = axios.create({
    baseURL: `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`,
    headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'dibe2-app-updater',
    },
    timeout: 10000,
})

function authHeader() {
    return { Authorization: `Bearer ${GITHUB_TOKEN}` }
}

function normalizeVersion(tag) {
    return String(tag || '').replace(/^v/i, '').trim()
}

// 최신(draft/prerelease 제외) 릴리스에서 .apk 자산을 찾는다.
async function getLatestRelease() {
    const { data } = await gh.get('/releases/latest', { headers: authHeader() })
    const apkAsset = (data.assets || []).find((a) => a.name.endsWith('.apk'))
    return { tagName: data.tag_name, notes: data.body || '', apkAsset }
}

// GET /api/app/latest — 최신 버전/변경사항. 앱이 package_info 버전과 비교해 업데이트 판단.
router.get('/latest', async (req, res) => {
    if (!GITHUB_TOKEN) return res.status(500).json({ error: 'GITHUB_TOKEN 미설정' })
    try {
        const { tagName, notes, apkAsset } = await getLatestRelease()
        if (!apkAsset) return res.status(404).json({ error: '릴리스 APK 자산이 없습니다.' })
        res.json({
            version: normalizeVersion(tagName),
            notes,
            size: apkAsset.size,
        })
    } catch (err) {
        if (err.response && err.response.status === 404) {
            return res.status(404).json({ error: '아직 릴리스가 없습니다.' })
        }
        console.error('앱 최신버전 조회 오류:', err.message)
        res.status(500).json({ error: '버전 정보를 가져오지 못했습니다.' })
    }
})

// GET /api/app/download — 로그인 사용자에게 단기 서명 URL을 반환.
// private 자산을 octet-stream으로 요청하면 GitHub이 서명 URL(objects.githubusercontent.com,
// 약 5분 유효)로 302를 주는데, 리다이렉트를 따라가지 않고 Location만 받아 그대로 넘긴다.
// (바이트를 Function이 프록시하지 않으므로 Netlify 6MB 응답 제한과 무관)
router.get('/download', async (req, res) => {
    if (!GITHUB_TOKEN) return res.status(500).json({ error: 'GITHUB_TOKEN 미설정' })
    try {
        const { tagName, apkAsset } = await getLatestRelease()
        if (!apkAsset) return res.status(404).json({ error: '릴리스 APK 자산이 없습니다.' })

        const assetRes = await axios.get(apkAsset.url, {
            headers: {
                ...authHeader(),
                Accept: 'application/octet-stream',
                'User-Agent': 'dibe2-app-updater',
            },
            maxRedirects: 0,
            validateStatus: (s) => s === 302 || s === 200,
        })

        const signedUrl = assetRes.headers.location
        if (!signedUrl) return res.status(502).json({ error: '다운로드 URL을 확보하지 못했습니다.' })

        res.json({
            url: signedUrl,
            version: normalizeVersion(tagName),
            size: apkAsset.size,
            filename: apkAsset.name,
        })
    } catch (err) {
        console.error('앱 다운로드 URL 발급 오류:', err.message)
        res.status(500).json({ error: '다운로드에 실패했습니다.' })
    }
})

module.exports = router
