// store/index.js
import { titleUpdatePlugin  } from "./plugins/titleUpdate"
import { mediaSessionPlugin } from "./plugins/mediaSession"

export const plugins = [titleUpdatePlugin, mediaSessionPlugin]