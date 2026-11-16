/**
 * 歌词行展示过滤（从 Player.tsx 抽出的纯逻辑，便于单测）。
 * 判定一行歌词文本是否值得在播放页/全屏歌词显示：剔除元数据、版权、宣传、时间轴等杂行。
 */

const lyricMetaPattern = /^(作词|作曲|编曲|制作|制作人|制作统筹|制片人|监制|出品|出品人|发行|营销|推广|视频推广|推广策划|录音|混音|母带|和声|和音|音讯编辑|乐队总监|键盘手|PGM|弦乐|录音室|录音|混音|母带|吉他|贝斯|鼓|词|曲|OP|SP|ISRC|企划|统筹|鸣谢|版权|未经|未经许可|未经著作权人|封面设计|封面|设计|视觉|摄影|海报|文案|Cover|Cover Design|Artwork|Art Design|Design|Visual|Photography|Lyricist|Composer|Arranger|Producer|Mixing|Mastering).*[:：]?/i
const lyricCopyrightPattern = /(未经|著作权人|许可|翻唱|翻录|使用|版权|Cover Design|Artwork|Art Design)/i
const lyricPromotionPattern = /(听歌就在|联合出品|特别企划|音乐计划|星曜计划|鲸鱼向海|酷狗|QQ音乐|网易云音乐|抖音|快手|出品|发行|推广|营销|鸣谢)/i
const lyricCreditColonPattern = /^[\u4e00-\u9fa5A-Za-z0-9 ®@/、·.（）()&-]{1,16}[:：]\s*[\u4e00-\u9fa5A-Za-z0-9 ®@/、·.（）()&-]{1,40}$/

export const isDisplayLyric = (text?: string | null) => {
  const value = text?.trim()
  if (!value) return false
  if (/^\[[^\]]+\]$/.test(value)) return false
  if (lyricMetaPattern.test(value)) return false
  if (lyricCopyrightPattern.test(value)) return false
  if (lyricPromotionPattern.test(value)) return false
  if (lyricCreditColonPattern.test(value)) return false
  if (/^[-–—_~·\s]+$/.test(value)) return false
  if (/^『.*』$/.test(value) && value.length > 12) return false
  if (/^[^-–—·]{1,40}\s*[-–—]\s*[^-–—]{1,30}$/.test(value)) return false
  return true
}
