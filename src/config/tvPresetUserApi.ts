export const TV_PRESET_USER_API_ID = 'user_api_tv_preset_default'
export const TV_PRESET_USER_API_CANDIDATES = [
  {
    id: 'tv_preset_juhe',
    name: '聚合API接口 (CF)',
    author: 'lerd',
    homepage: 'https://raw.githubusercontent.com/pdone/lx-music-source/main/juhe/latest.js',
    assetPath: 'script/tv-default-user-api-juhe.js',
  },
  {
    id: 'tv_preset_huibq',
    name: 'Huibq_lxmusic源',
    author: 'Huibq',
    homepage: 'https://raw.githubusercontent.com/pdone/lx-music-source/main/huibq/latest.js',
    assetPath: 'script/tv-default-user-api-huibq.js',
  },
  {
    id: 'tv_preset_grass',
    name: '野草',
    author: 'pdone',
    homepage: 'https://raw.githubusercontent.com/pdone/lx-music-source/main/grass/latest.js',
    assetPath: 'script/tv-default-user-api.js',
  },
  {
    id: 'tv_preset_flower',
    name: '花',
    author: 'pdone',
    homepage: 'https://raw.githubusercontent.com/pdone/lx-music-source/main/flower/latest.js',
    assetPath: 'script/tv-default-user-api-flower.js',
  },
] as const
