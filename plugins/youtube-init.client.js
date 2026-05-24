// 오디오 재생용 YouTube IFrame 컨테이너를 body에 고정 마운트.
// 레이아웃 전환(main↔video↔admin 등) 시에도 DOM이 살아남아야
// utils/youtubePlayer.js 의 YT.Player 인스턴스 바인딩이 좀비화되지 않음.
export default function () {
    if (typeof document === 'undefined') return
    if (document.getElementById('youtube-player')) return

    const div = document.createElement('div')
    div.id = 'youtube-player'
    div.className = 'hidden'
    document.body.appendChild(div)
}
