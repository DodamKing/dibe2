// 테마 정의 — 수집 스크립트가 실행할 때마다 Theme 컬렉션에 upsert 한다.
// 검색어·키워드는 2026-10-17 검증 수집 기준. 바꾸면 다음 수집부터 반영된다. 상세는 docs/THEME_PLAYLIST.md
//
// keywords: 플레이리스트 "제목"이 이 테마인지 판정 (맞으면 가중치 1, 아니면 0.3)

module.exports = [
    {
        key: 'rain', name: '비 오는 날', order: 1,
        keywords: /비|rain|장마|빗|우산|소나기|흐린/i,
        // 2026-11-08: 같은 말 반복("비올때 듣는 노래 플레이리스트" 등)은 검색 결과 플리가 겹쳐 고유 플리 52개뿐 → 상황을 다양하게
        queries: [
            '비 오는 날 듣기 좋은 노래', 'rainy day kpop playlist', '장마철 듣기 좋은 노래', '비 오는 밤 감성 노래',
            'rainy day korean songs playlist', '빗소리와 어울리는 노래', '흐린 날 듣기 좋은 노래', '비 오는 날 카페 노래',
            '비 오는 날 인디 노래', '창밖에 비 내릴 때 듣는 노래', '우산 쓰고 걸을 때 듣는 노래',
            // '비 오는 날 알앤비'는 뺐다 — 미국 R&B 플리를 끌어와 core 상위에 해외곡이 몰렸다(2026-11-08 비교 수집)
        ],
    },
    {
        key: 'autumn', name: '가을', order: 2,
        keywords: /가을|autumn|fall|낙엽|선선/i,
        queries: [
            '가을 감성 노래 플레이리스트', '가을에 듣기 좋은 노래', '가을 발라드 플리', '선선한 가을 노래 모음',
            'autumn kpop playlist', '가을 인디 플리', '가을밤 노래', '가을 감성 kpop',
        ],
    },
    {
        key: 'drive', name: '드라이브', order: 3,
        keywords: /드라이브|drive|차에서|운전/i,
        queries: [
            '드라이브 할때 듣는 노래', '드라이브 플레이리스트 kpop', '신나는 드라이브 노래', '밤 드라이브 노래 플리',
            'drive kpop playlist', '드라이브 감성 플리', '여름 드라이브 노래', '한강 드라이브 노래',
        ],
    },
    {
        key: 'travel', name: '여행', order: 4,
        keywords: /여행|travel|trip|비행기|제주|기차|떠나/i,
        queries: [
            '여행 갈때 듣는 노래', '여행 플레이리스트 kpop', '여행 감성 플리', '비행기에서 듣는 노래',
            '제주도 여행 노래', 'travel kpop playlist', '기차 여행 노래', '여행 브이로그 노래',
        ],
    },
    {
        key: 'workout', name: '운동', order: 5,
        keywords: /운동|헬스|workout|gym|러닝|런닝|running|다이어트/i,
        queries: [
            '운동할때 듣는 노래', '헬스 노래 플레이리스트 kpop', '운동 플리 kpop', '러닝할때 듣는 노래',
            'workout kpop playlist', 'gym kpop playlist', '운동 동기부여 노래', '런닝 플리',
        ],
    },
    {
        key: 'hype', name: '신나는', order: 6,
        keywords: /신나|텐션|흥|hype|party|파티|기분\s*좋/i,
        queries: [
            '신나는 노래 플레이리스트', '텐션 업 kpop 플리', '기분 좋아지는 신나는 노래', '신나는 kpop 모음',
            'hype kpop playlist', '흥 폭발 노래', '파티 kpop 플리', '신나는 가요 플리',
        ],
    },
    {
        key: 'calm', name: '잔잔한', order: 7,
        keywords: /잔잔|힐링|편안|calm|휴식|relax|차분|조용|어쿠스틱|acoustic|잠들/i,
        // 2026-11-08: core 124곡으로 부족 → 상황(잠들기 전·새벽·카페·공부)을 넓혀 검색어 추가
        queries: [
            '잔잔한 노래 플레이리스트', '잔잔한 가요 모음', '힐링 노래 플리', '편안하게 듣는 노래',
            'calm kpop playlist', '잔잔한 인디 노래', '마음이 편해지는 노래', '휴식 노래 플리',
            '잠들기 전 듣는 노래', '조용한 노래 모음', '어쿠스틱 감성 노래', '공부할때 듣는 잔잔한 가요',
        ],
    },
    {
        key: 'flutter', name: '설렘', order: 8,
        keywords: /설레|설렘|썸|고백|달달|love|사랑|연애/i,
        queries: [
            '설레는 노래 플레이리스트', '설렘 가득 노래 kpop', '썸탈때 듣는 노래', '사랑 고백 노래 플리',
            'love song kpop playlist', '달달한 노래 모음', '연애 초기 노래', '설렘 플리',
        ],
    },
    {
        key: 'breakup', name: '이별', order: 9,
        keywords: /이별|헤어|슬픈|sad|눈물|그리움|breakup/i,
        queries: [
            '이별 노래 플레이리스트', '헤어진 후 듣는 노래', '이별 발라드 모음', '슬픈 노래 플리 kpop',
            'sad kpop playlist', '눈물 나는 노래', '이별 감성 플리', '이별 후 듣는 노래 모음',
        ],
    },
]
