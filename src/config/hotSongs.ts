// 热门歌曲拼音词典（TV 搜索联想用，歌手见 hotArtists.ts）
// 格式：歌名|全拼|缩写|歌手
import { HOT_ARTISTS } from './hotArtists'

const RAW = `晴天|qingtian|qt|周杰伦
七里香|qilixiang|qlx|周杰伦
告白气球|gaobaiqiqiu|gbqq|周杰伦
稻香|daoxiang|dx|周杰伦
青花瓷|qinghuaci|qhc|周杰伦
夜曲|yequ|yq|周杰伦
搁浅|geqian|gq|周杰伦
说好不哭|shuohaobuku|shbk|周杰伦
等你下课|dengnixiake|dnxk|周杰伦
花海|huahai|hh|周杰伦
枫|feng|f|周杰伦
简单爱|jiandanai|jda|周杰伦
安静|anjing|aj|周杰伦
龙卷风|longjuanfeng|ljf|周杰伦
双截棍|shuangjiegun|sjg|周杰伦
东风破|dongfengpo|dfp|周杰伦
菊花台|juhuatai|jht|周杰伦
彩虹|caihong|ch|周杰伦
江南|jiangnan|jn|林俊杰
修炼爱情|xiulianaiqing|xlaq|林俊杰
她说|tashuo|ts|林俊杰
曹操|caocao|cc|林俊杰
可惜没如果|keximeiruguo|kmrg|林俊杰
不为谁而作的歌|buweishuierzodege too long|skip|林俊杰
十年|shinian|sn|陈奕迅
浮夸|fukua|fk|陈奕迅
好久不见|haojiubujian|hjbj|陈奕迅
爱情转移|aiqingzhuanyi|aqzy|陈奕迅
红玫瑰|hongmeigui|hmg|陈奕迅
孤勇者|guyongzhe|gyz|陈奕迅
K歌之王|kgzw|kgzw|陈奕迅
光年之外|guangnianzhiwai|gnzw|邓紫棋
泡沫|paomo|pm|邓紫棋
句号|juhao|jh|邓紫棋
来自天堂的魔鬼|laizitiandangdemogui too long|skip|邓紫棋
演员|yanyuan|yy|薛之谦
丑八怪|choubaguai|cbg|薛之谦
认真的雪|renzhandexue|rzdx|薛之谦
刚刚好|gangganghao|ggh|薛之谦
动物世界|dongwushijie|dwsj|薛之谦
倔强|juejiang|jj|五月天
突然好想你|turanhaoxiangni|trhxn|五月天
知足|zhizu|zz|五月天
温柔|wenrou|wr|五月天
后来的我们|houlaidewomen|hldwm|五月天
吻别|wenbie|wb|张学友
一千个伤心的理由|yiqiangeshangxinliyou too long|skip|张学友
她来听我的演唱会|talaitingwodeyanchanghui too long|skip|张学友
忘情水|wangqingshui|wqs|刘德华
冰雨|bingyu|by|刘德华
男人哭吧不是罪|narenkubabushizui|nrkbb sz|刘德华
红豆|hongdou|hd|王菲
传奇|chuanqi|cq|王菲
匆匆那年|congcongnanian|ccnn|王菲
我愿意|woyuanyi|wyy|王菲
遇见|yujian|yj|孙燕姿
天黑黑|tianheihei|thh|孙燕姿
开始懂了|kaishidongle|ksdl|孙燕姿
勇气|yongqi|yq|梁静茹
宁夏|ningxia|nx|梁静茹
暖暖|nuannuan|nn|梁静茹
可惜不是你|kexibushini|kxbu shini|梁静茹
会呼吸的痛|huihuxidetong|hhxdt|梁静茹
听海|tinghai|th|张惠妹
记得|jide|jd|张惠妹
征服|zhengfu|zf|那英
白天不懂夜的黑|baitianbudongyedehei|btbdydh|那英
小幸运|xiaoxingyun|xxy|田馥甄
消愁|xiaochou|xc|毛不易
像我这样的人|xiangwozheyangderen|xwzydr|毛不易
不染|buran|br|毛不易
大鱼|dayu|dy|周深
光亮|guangliang|gl|周深
起风了|qifengle|qfl|周深
我曾|woceng|wc|隔壁老樊
南山南|nanshannan|nsn|马頔
董小姐|dongxiaojie|dxj|宋冬野
安和桥|anheqiao|ahq|宋冬野
成都|chengdu|cd|赵雷
南方姑娘|nanfangguniang|nfgn|赵雷
画|hua|h|赵雷
平凡之路|pingfanzhilu|pfzl|朴树
那些花儿|naxiehuar|nxhr|朴树
白桦林|baihualin|bhl|朴树
蓝莲花|lanlianhua|llh|许巍
曾经的你|cengjingdeni|cjdn|许巍
故乡|guxiang|gx|许巍
北京北京|beijingbeijing|bjbj|汪峰
怒放的生命|nufangdeshengming|nfdsm|汪峰
飞得更高|feidegengao|fdgg|汪峰
李白|libai|lb|李荣浩
模特|mote|mt|李荣浩
年少有为|nianshaoyouwei|nsyw|李荣浩
麻雀|maque|mq|李荣浩
逆战|nizhan|nz|张杰
天下|tianxia|tx|张杰
这就是爱|zhejiushiai|zjsa|张杰
烟火里的尘埃|yanhuolidechenai|yhldca|华晨宇
月亮代表我的心|yueliangdaibiaowodexin|yldb wdx|邓丽君
甜蜜蜜|tianmimi|tmm|邓丽君
小城故事|xiaochenggushi|xcgs|邓丽君
我只在乎你|wozhizaizuni|wzzzn|邓丽君
月亮之上|yueliangzhishang|ylzs|凤凰传奇
最炫民族风|zuixuanminzufeng|zxmzf|凤凰传奇
荷塘月色|hetangyuese|htys|凤凰传奇
冲动的惩罚|chongdongdechufa|cddcf|刀郎
西海情歌|xihaiqingge|xhqg|刀郎
画心|huaxin|hx|张靓颖
终于等到你|zhongyudengdani|zyddn|张靓颖
我的梦|wodemeng|wdm|张靓颖
说谎|shuohuang|sh|林宥嘉
成全|chengquan|cq|林宥嘉
全世界谁倾听你|quanshishuishuitingni too long|skip|林宥嘉
执着|zhizhuo|zz|田震
野花|yehua|yh|田震
千千阙歌|qianqianquege|qqqg|陈慧娴
飘雪|piaoxue|px|陈慧娴
女人花|nvrenhua|nrh|梅艳芳
亲密爱人|qinmiairen|qmr|梅艳芳
当爱已成往事|dangaiyichengwangshi|daycws|张国荣
风继续吹|fengjixuchui|fjxc|张国荣
海阔天空|haikuotiankong|hktk|Beyond
光辉岁月|guanghuisuiyue|ghsy|Beyond
真的爱你|zhendaini|zda n|Beyond
喜欢你|xihuanni|xhn|Beyond
后来|houlai|hl|刘若英
很爱很爱你|henaihenaini|hah a n|刘若英
为爱痴狂|weiaichikuang|wa ck|任贤齐
心太软|xintairuan|xtr|任贤齐
对面的女孩看过来|duimiandenvhaikanguolai too long|skip|任贤齐
伤心太平洋|shangxintaipingyang|sxtpy|任贤齐
朋友|pengyou|py|周华健
花心|huaxin|hx|周华健
让我欢喜让我忧|rangwohuanxirangwoyou too long|skip|周华健
痴心绝对|chixinjuedui|cxjd|李圣杰
手放开|shoufangkai|sfk|李圣杰
爱如潮水|airuchaoshui|arcs|张信哲
过火|guohuo|gh|张信哲
信仰|xinyang|xy|张信哲
唯一|weiyi|wy|王力宏
大城小爱|dachengxiaoai|dcxa|王力宏
需要人陪|xuyaorenpei|xyrp|王力宏
爱很简单|aihenjiandan|ahjd|陶喆
普通朋友|putongpengyou|ptpy|陶喆
小镇姑娘|xiaozhenniangniang|xznn|陶喆
爱你|aini|an|王心凌
睫毛弯弯|jiemaowanwan|jmww|王心凌
第一次爱的人|diyiciaianderen|dycad r|王心凌
说爱你|shuoini|shni|蔡依林
日不落|ribuluo|rbl|蔡依林
倒带|daodai|dd|蔡依林
中国话|zhongguohua|zgh|SHE
不想长大|buxiangzhangda|bxzd|SHE
隐形的翅膀|yinxingdechibang|yxdcb|张韶涵
欧若拉|oruola|orl|张韶涵
遗失的美好|yishidemeihao|ysdmh|张韶涵
暧昧|aimei|am|杨丞琳
左边|zuobian|zb|杨丞琳
雨爱|yuai|ya|杨丞琳
我们的爱|womendeai|wmda|飞儿乐队
千年之恋|qiannianzhilian|qnzl|飞儿乐队
死了都要爱|sile douyaoai|sldya|信乐团
离歌|lige|lg|信乐团
当|dang|d|动力火车
大约在冬季|dayuezaidongji|dyzdj|齐秦
夜夜夜夜|yeyeyeye|yyyy|齐秦
外面的世界|waimiandeshijie|wmdsj|齐秦
山丘|shanqiu|sq|李宗盛
凡人歌|fanrenge|frg|李宗盛
童年|tongnian|tn|罗大佑
光阴的故事|guangyindegushi|gydgs|罗大佑
水手|shuishou|ss|郑智化
星星点灯|xingxingdiandeng|xxdd|郑智化
一无所有|yiwusuoyou|yw sy|崔健
花房姑娘|huafangguniang|hfgn|崔健
同桌的你|tongzhuodeni|tzdn|老狼
睡在我上铺的兄弟|shuizaiwoshangpudexiongdi too long|skip|老狼
一生有你|yishengyouni|ysyn|水木年华
最美|zuimei|zm|羽泉
奔跑|benpao|bp|羽泉
夜空中最亮的星|yekongzhongzuiliangdexing too long|skip|逃跑计划
追梦赤子心|zhumengchizixin|zmczx|GALA
小情歌|xiaoqingge|xqg|苏打绿
无与伦比的美丽|wuyulunbidemeili|wylbdml|苏打绿
我好想你|wohaoxiangni|whxn|苏打绿
年轮|nianlun|nl|张碧晨
凉凉|liangliang|ll|张碧晨
一次就好|yicijiuhao|ycjh|杨宗纬
洋葱|yangcong|yc|杨宗纬
红颜|hongyan|hy|胡彦斌
小星星|xiaoxingxing|xxx|汪苏泷
有点甜|youdiantian|ydt|汪苏泷
素颜|suyan|sy|许嵩
断桥残雪|duanqiaocanxue|dqcx|许嵩
城府|chengfu|cf|许嵩
灰色头像|huisetouxiang|hstx|许嵩
雅俗共赏|yasugongshang|ysgs|许嵩
永不失联的爱|yongbushilianai|yobsl a|单依纯
可可托海的牧羊人|keketuohaidemuyangren too long|skip|王琪
点歌的人|diangederen|dgdr|海来阿木
不过人间|buguorenjian|bgrj|海来阿木
我们不一样|womengbuyiyang|wmbyy|大壮
飞鸟和蝉|feiniaohechan|fnhc|任然
思念|sinian|sn|毛阿敏
爱的奉献|aidedefengxian|addfx|韦唯
好一朵美丽的茉莉花|haoyiduomeilidemolihua too long|skip|宋祖英
茉莉花|molihua|mlh|宋祖英
难忘今宵|nawangjinxiao|nwjx|李谷一
我的中国心|wodezhongguoxin|wdzgx|张明敏
千年等一回|qianniandengyihui|qndyh|高胜美
向天再借五百年|xiangtianzaijiewubainian too long|skip|韩磊
好汉歌|haohange|hhg|刘欢
从头再来|congtouzailai|ctzl|刘欢
弯弯的月亮|wanwandeyueliang|wwdyl|刘欢
拯救|zhengjiu|zj|孙楠
你快回来|nikuaihuilai|nkhl|孙楠
天路|tianlu|tl|韩红
家乡|jiaxiang|jx|韩红
老鼠爱大米|laoshuaidami|lsadm|杨臣刚
求佛|qiufu|qf|誓言
秋天不回来|qiutianbuhuilai|qtbhl|王强
套马杆|taomagan|tmg|乌兰图雅
小苹果|xiaopingguo|xpg|筷子兄弟
学猫叫|xuemiaojiao|xmj|小潘潘
卡路里|kaluli|kll|火箭少女
生僻字|shengpizi|spz|陈柯宇
少年|shaonian|sn|梦然
你的答案|nidedaan|nda|阿冗
那些年|naxienian|nxn|胡夏
至少还有你|zhishaohaiyouni|zshyn|林忆莲
涛声依旧|taoshengyijiu|tsyj|毛宁
一剪梅|yijianmei|yjm|费玉清
大花轿|dahuajiao|dhj|火风
常回家看看|changhuijiakankan|chjkk|陈红
好日子|haorizi|hrz|宋祖英
上海滩|shanghaitan|sht|叶丽仪
沧海一声笑|canghaiyishengxiao|chysx|罗大佑
月亮惹的祸|yueliangredehuo|ylrdh|张宇
用心良苦|yongxinliangzuo|yxlz|张宇
吻得太逼真|wende taibizhen|wdtbz|张栋梁
当你孤单你会想起谁|dangnigudanni huiqishei too long|skip|张栋梁
下个路口见|xiagelukoujian|xglkj|李宇春
无价之姐|wujiazhijie|wjzj|李宇春
我的滑板鞋|wodehuabanxie|wdhbx|庞麦郎
突然的自我|turandeziwo|t e dz w|伍佰
挪威的森林|nuowedesenlin|nwesl|伍佰
痛哭的人|tongkuderen|tkdr|伍佰`

export interface HotSong {
  name: string
  pinyin: string
  abbr: string
  artist: string
}

export const HOT_SONGS: HotSong[] = RAW.trim().split('\n').map(line => {
  const [name, pinyin, abbr, artist] = line.trim().split('|')
  return { name, pinyin, abbr, artist }
}).filter(song => song.pinyin && !song.pinyin.includes(' '))

export interface HotSearchItem {
  keyword: string
  label: string
  pinyin: string
  abbr: string
}

/** 歌手 + 歌曲合并联想池 */
export const HOT_SEARCH_ITEMS: HotSearchItem[] = [
  ...HOT_ARTISTS.map(a => ({ keyword: a.name, label: a.name, pinyin: a.pinyin, abbr: a.abbr })),
  ...HOT_SONGS.map(s => ({ keyword: s.name, label: `${s.name} · ${s.artist}`, pinyin: s.pinyin, abbr: s.abbr })),
]

/** 输入纯字母时按 全拼/首字母 匹配热门歌手与歌曲 */
export const matchHotSearch = (input: string, limit = 8): HotSearchItem[] => {
  const q = input.toLowerCase().trim()
  if (!q || !/^[a-z]+$/.test(q)) return []
  const scored: Array<{ item: HotSearchItem, score: number }> = []
  for (const item of HOT_SEARCH_ITEMS) {
    let score = 0
    if (item.pinyin === q) score = 100
    else if (item.abbr === q) score = 95
    else if (item.pinyin.startsWith(q)) score = 70 + q.length
    else if (q.length >= 2 && item.abbr.startsWith(q)) score = 60 + q.length
    else if (q.length >= 4 && item.pinyin.includes(q)) score = 30 + q.length
    if (score > 0) scored.push({ item, score })
  }
  return scored.sort((a, b) => b.score - a.score || a.item.pinyin.length - b.item.pinyin.length).slice(0, limit).map(s => s.item)
}

/** 全拼完全匹配（用于提交搜索时的自动纠偏） */
export const matchExactPinyin = (input: string): HotSearchItem | null => {
  const q = input.toLowerCase().trim()
  return HOT_SEARCH_ITEMS.find(item => item.pinyin === q) ?? null
}
