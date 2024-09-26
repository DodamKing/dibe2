const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
const fs = require('fs').promises

puppeteer.use(StealthPlugin())

// 브라우저 및 페이지 설정
async function setupBrowser() {
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-notifications', '--disable-iframe-sandbox'],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768 });
    return { browser, page };
}

// 요청 인터셉션 설정
async function setupRequestInterception(page) {
    await page.setRequestInterception(true);
    page.on('request', request => {
        if (request.resourceType() === 'script' && request.url().includes('ad')) {
            request.abort();
        } else {
            request.continue();
        }
    });
}

// 페이지 로드 및 초기 설정
async function loadPage(page, url) {
    console.log('Navigating to', url);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    console.log('Page loaded');

    await page.evaluate(() => {
        const removeOverlays = () => {
            const selectors = [
                'div[class*="popup"]', 'div[id*="popup"]',
                'div[class*="modal"]', 'div[id*="modal"]',
                'div[class*="overlay"]', 'div[id*="overlay"]',
                'iframe',
                'div[style*="position: fixed"]',
                'div[style*="z-index: 9999"]',
            ];
            selectors.forEach(selector => {
                document.querySelectorAll(selector).forEach(el => el.remove());
            });
            document.body.style.overflow = 'auto';
            document.body.style.filter = 'none';
        };

        setInterval(removeOverlays, 500);

        const style = document.createElement('style');
        style.textContent = `
        body, html { overflow: auto !important; }
        * { pointer-events: auto !important; }
      `;
        document.head.appendChild(style);
    });
}

// 오디오 탭으로 이동
async function navigateToAudioTab(page) {
    const audioTabSelector = '#mp3';
    await page.waitForSelector(audioTabSelector, { timeout: 30000 });
    await page.click(audioTabSelector);

    await page.waitForFunction(() => {
        const table = document.querySelector('#mp3 table tbody');
        return table && table.children.length > 0;
    }, { timeout: 30000 });
}

// 오디오 옵션 추출
async function extractAudioOptions(page) {
    return await page.evaluate(() => {
        const options = [];
        const rows = document.querySelectorAll('#mp3 table tbody tr');
        rows.forEach(row => {
            const qualityEl = row.querySelector('td:first-child');
            const sizeEl = row.querySelector('td:nth-child(2)');
            const downloadBtn = row.querySelector('td a.btn-success');

            if (qualityEl && sizeEl && downloadBtn) {
                const quality = qualityEl.textContent.trim();
                const size = sizeEl.textContent.trim();
                const onclick = downloadBtn.getAttribute('onclick');
                let downloadId = null;
                if (onclick) {
                    const match = onclick.match(/(?:')([^']+)(?:')/g);
                    if (match && match.length >= 3) {
                        downloadId = match[2].replace(/'/g, '');
                    }
                }
                options.push({ quality, size, downloadId });
            }
        });
        return options;
    });
}

// 비디오 제목 추출
async function extractTitle(page) {
    return await page.evaluate(() => {
        const titleElement = document.querySelector('.caption');
        return titleElement ? titleElement.textContent.trim() : null;
    });
}

// 스크린샷 저장
async function saveScreenshot(page, filename) {
    await page.screenshot({ path: filename, fullPage: true });
}

// 오류 처리 및 로깅
async function handleError(error, page) {
    console.error('Detailed error:', error);
    if (page) {
        const pageContent = await page.content();
        await fs.writeFile('error_page_content.html', pageContent);
        await saveScreenshot(page, 'error_screenshot.png');
    }
}

// 메인 스크래핑 함수
module.exports = {
    scrapeY2mate: async function (videoId) {
        const y2mateUrl = `https://www.y2mate.com/youtube/${videoId}`;
        let browser;
        let page;
    
        try {
            ({ browser, page } = await setupBrowser());
            await setupRequestInterception(page);
            await loadPage(page, y2mateUrl);
            await navigateToAudioTab(page);
    
            const title = await extractTitle(page);
            const audioOptions = await extractAudioOptions(page);
    
            if (!title || audioOptions.length === 0) {
                throw new Error('Failed to extract data from the page');
            }
    
            const result = { title, audioOptions };
            console.log('Extracted data:', result);
    
            await saveScreenshot(page, 'audio_options.png');
    
            return result;
        } catch (error) {
            await handleError(error, page);
            throw error;
        } finally {
            if (browser) {
                await browser.close();
            }
        }
    }
}