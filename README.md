# dibe2

## 남은 것
> - [x] 서버미들웨어 별 에러를 따로 관리하고 errhandler 미들웨어를 없애야 할듯
> - [x] 플레이리스트에 추가 하고 나서 상세화면에 바로 적용 되지 않는 이슈
> - [x] 소셜 로그인 기능이 필요
> - [x] 가장 중요한 관리자 기능으로 수동 음원 추가 기능 필요
> - [x] 새로 로그인한 사용자에 대한 스토어 초기화 문제
> - [ ] iframe에서 커스텀 미디어 세션이 적용이 안되는 이슈
> - [x] 반복재생 아이콘
> - [x] 관리자 유저 관리
> - [ ] 관리자 대시보드
> - [x] 일일 방문자
> - [ ] 음원 추가, 수정 요청란
> - [ ] 음원 스트리밍 카운팅
> - [x] 무제한 기간 늘리기 지금은 100년임 -> 1000년으로 변경경
> - [x] 1일 이하 남은 사용자는 시간으로 표시하자
> - [x] 플레이리스트이름 수정하는 기능 없다
> - [x] 차트 좌우 간격이 다 다르다

## 12월 13일
    사용자 제한 구현으로 인한 페이지 및 api 제한 추가
    재생 목록 곡 추가 개수 제한 1000 및 사용자 알림 수정
    재생목록 ui 개선 및 스크롤, 드래그 버그 수정
    반복재생 아이콘 해결결

## 12월 12일
    사용자 기간 제한 구현

## 10월 31일
    유저 스키마 변경
    대시보드 사용자 통계 수정

## 10월 16일
    db 연결, cron build module로 수정
    대시보드 방문자 통계 수정
    사용자 관리 추가

## 10월 8일
    favicon 추가
    nginx GeoIP 모듈 사용해서 해외 아이피 차단, 악성 트래픽 대응

## 10월 2일
    음원정보 추가, 수정 관리자 기능 구현
    노래제목과 가수로 곡 유무를 판별했는데 앨범도 추가해야 할 지 고민

## 9월 30일
    볼륨 버그 수정 -> 테스트는 필요
    관리자 페이지 설정 중

## 9월 27일
    소셜 로그인 완료 -> 카카오는 로그아웃 시 재인증, 구글은 계정 선택만
    로그인 페이지 타이틀 변경
    반복재생, 셔플 스트로지 저장, 반복 재생 아이콘은 더 이쁘게 바꾸면 더 좋을 것 같기는 함
    로그아웃 할 때 그냥 페이지 리로드 시켜버려서 상태 다 초기화 해서 스토어 초기화 관련 이슈 해결

## 9월 26일
    구글 로그인 로컬에서 구현, 재생목록 초기화 관련 이슈가 남음

## 9월 25일
    디비 커넥션 누수 현상 없음
    플레이어 컨트롤러 모바일 대응, 검색에서 전체 탭 제거, 곡 추가 기능에서 내 플레이리스트에 추가 기능 수정


    할일
        서버미들웨어 별 에러를 따로 관리하고 errhandler 미들웨어를 없애야 할듯
        플레이리스트에 추가 하고 나서 상세화면에 바로 적용 되지 않는 이슈
        반복재생, 셔플에 대한 폰트어썸 적용 고민 -> 디테일 고민, 로컬 스토리지 저장 필요
        소셜 로그인 기능이 필요
        가장 중요한 관리자 기능으로 수동 음원 추가 기능 필요
        iframe에서 커스텀 미디어 세션이 적용이 안되는 이슈

## 9월 24일
    디비 커넥션 누수 잡은 듯 함 지켜봐야 하지만
    서버 재시작 해서 pm2 시간 해결함
    invidious도 aws ip에서 벤당하는 거 같아서 다시 iframe로 돌아옴
    뮤직플레이 컨트롤러 ui -> 일단 모바일에서 제목, 가수명 없애서 보이게 해봤음

    서버미들웨어 별 에러를 따로 관리하고 errhandler 미들웨어를 없애야 할듯
    플레이리스트에 추가 하고 나서 상세화면에 바로 적용 되지 않는 이슈
    반복재생, 셔플에 대한 폰트어썸 적용 고민 -> 디테일 고민, 로컬 스토리지 저장 필요
    소셜 로그인 기능이 필요
    가장 중요한 관리자 기능으로 수동 음원 추가 기능 필요
    iframe에서 커스텀 미디어 세션이 적용이 안되는 이슈


## 9월 20일
    iframe으로 대체 -> invidious로 가능성 확인

    pm2 재시작 스크립트 작성, 로그에 시간 문제
    뮤직 플레이 컨트롤러 ui
    errhandler cron, api 나눠서 각각 따로 분리
    플레이리스트에 추가 하고 나서 상세화면에 바로 적용 되지 않는 이슈
    반복재생, 셔플에 대한 폰트어썸 적용 고민 -> 디테일 고민, 로컬 스토리지 저장 필요

## 9월 20일
    ydtl bot 이슈 -> iframe으로 대체 생각 -> 어느 정도 완성
    pm2 재시작 스크립트 작성, 로그에 시간 문제
    뮤직 플레이 컨트롤러 ui
    errhandler cron, api 나눠서 각각 따로 분리

    -> 미디어 세션이 작동 안하고 유튜브 iframe 에서 주는 메타데이터가 적용됨, 유튜브 아이디가 잘 못 되었을 때 예외처리가 필요함

## 9월 13일
    production 환경에서 세션, 쿠키 문제 -> 해결 (app.set('trust proxy', 1))

    플레이리스트에 추가 하고 나서 상세화면에 바로 적용 되지 않는 이슈
    반복재생, 셔플에 대한 폰트어썸 적용 고민 -> 디테일 고민, 로컬 스토리지 저장 필요
    로그인 페이지 아이콘 버그 -> 해결
    서버 pm2 로그 시간

## 9월 12일
    api 에러 hooks에 안 잡힘 -> middleware로 변경하여 처리
    원인 불명 로그아웃 안한 상태로 재접속 했을 때 상태 이상 -> 폰트어썸 cdn 문제로 보임
    플레이리스트 상세페이지 만들어서 모바일에서 삭제 할 때 안되고 페이지 넘어감 -> 개선

    플레이리스트에 추가 하고 나서 상세화면에 바로 적용 되지 않는 이슈
    반복재생, 셔플에 대한 폰트어썸 적용 고민
    로그인 페이지 아이콘 버그
    서버 pm2 로그 시간

## 9월 11일
    cors
    pm2 배포 스크립트
    서버 오류 메시지 확인

## 9월 9일
    화면 레이아웃 다듬기
    플레이리스트 곡제거 백엔드 구현

## 9월 8일
    서버 오류 미들웨서 설정 -> 슬랙 메시지
    오디오 볼륨 초기화 버그 수정

## 2024년 8월 27일 시작
    목표: 스트리밍, top 100, 내플레이리스트, 검색, 관리자기능, 소셜로그인