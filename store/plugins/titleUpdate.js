export const titleUpdatePlugin = store => {
    store.subscribe((mutation, state) => {
        if (mutation.type === 'player/SET_CURRENT_TRACK') {
            const currentTrack = state.player.currentTrack
            if (currentTrack) {
                document.title = `${currentTrack.title} - ${currentTrack.artist} | DIBE2`
            } else {
                document.title = 'DIBE2' // 기본 타이틀
            }
        }
    })
}