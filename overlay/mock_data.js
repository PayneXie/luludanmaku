// Mock Data Configuration for OBS Chat Overlay

// Additional Avatar Sources (UID -> URL)
const MOCK_AVATAR_SOURCES = {
    "3658": "https://i1.hdslb.com/bfs/face/5c2c71c3e8bb094568d0bf650f4903533292f77d.jpg",
    "9357": "https://i0.hdslb.com/bfs/face/member/noface.jpg",
    "17912": "https://i2.hdslb.com/bfs/face/6e1e3aaabe273ad451794c64632b675afd23b5be.jpg",
    "20121": "https://i0.hdslb.com/bfs/face/2a5610bdaac60322cda658af7b8e9cb625f07a67.jpg",
    "30026": "https://i2.hdslb.com/bfs/face/d0f92aeacedd01a61b05f7f7c5a1491bb5b6e0b9.jpg"
};

// Generate users from avatar sources
const GENERATED_USERS = Object.entries(MOCK_AVATAR_SOURCES).map(([uid, url]) => ({
    name: `User_${uid}`,
    guard: Math.random() > 0.8 ? (Math.floor(Math.random() * 3) + 1) : 0, // Random guard status
    avatar: url.trim().replace(/`/g, '') // Clean up any backticks or spaces if present
}));

// Users Pool
const MOCK_USERS = [
    { name: "bili_123456", guard: 0, avatar: 'https://i0.hdslb.com/bfs/face/member/noface.jpg' },
    { name: "Captain_888", guard: 3, avatar: 'https://i0.hdslb.com/bfs/face/member/noface.jpg' }, 
    { name: "Admiral_Fan", guard: 2, avatar: 'https://i0.hdslb.com/bfs/face/member/noface.jpg' }, 
    { name: "Governor_001", guard: 1, avatar: 'https://i0.hdslb.com/bfs/face/member/noface.jpg' }, 
    { name: "Kusa_w", guard: 0, avatar: 'https://i0.hdslb.com/bfs/face/member/noface.jpg' },
    { name: "Miku_39", guard: 3, avatar: 'https://i0.hdslb.com/bfs/face/member/noface.jpg' },
    { name: "DD_King", guard: 0, avatar: 'https://i0.hdslb.com/bfs/face/member/noface.jpg' },
    ...GENERATED_USERS
];

// Chat Content Pool
const MOCK_CONTENT = [
    "主播好帅", "今天玩什么？", "哈哈哈哈", "???", "前面那个别走", "打卡", "晚安", "666", "下饭", 
    "这就是技术主播吗", "爱了爱了", "第一第一", "这个效果不错", "前排", "刚来，发生了什么", 
    "kswl", "好耶", "这也行？", "富婆饿饿", "下次一定", "这就去买", "老板大气", "恭喜老板",
    "泪目", "好听好听", "再来亿遍", "妙啊", "这不科学", "甚至还有点想笑", "草", "233333",
    "要素过多", "梦开始的地方", "害怕", "危", "下次还敢", "禁止套娃", "爷青回", "这就去对线"
];

// Super Chat Pool
const MOCK_SC = [
    { price: 30, content: "主播加油！", level: 0 },
    { price: 50, content: "坚持5小时直播时长不松懈", level: 1 },
    { price: 100, content: "主包端午快乐我有个朋友她全身绿绿的爱吃粽子", level: 2 },
    { price: 500, content: "The quick brown fox jumps over the lazy dog", level: 3 },
    { price: 1000, content: "大伙现在怎么不爱用Doodle了呢，是访问不到吗", level: 4 },
    { price: 2000, content: "感谢主播带来的精彩节目！", level: 5 }
];

// Gift Pool
const MOCK_GIFTS = [
    { name: "辣条", price: 0.1, icon: "https://s1.hdslb.com/bfs/live/d57afb7c5596359970cf430655cc716d884172a7.png" },
    { name: "小心心", price: 0, icon: "https://s1.hdslb.com/bfs/live/a02092c2866952402685764d0d36746f363c4739.png" },
    { name: "牛哇牛哇", price: 2, icon: "https://s1.hdslb.com/bfs/live/8290a6042468305c4866840742d48348d6268840.png" },
    { name: "情书", price: 52, icon: "https://s1.hdslb.com/bfs/live/52c803e30d6d567f24097f4a250325b59784b39a.png" },
    { name: "摩天大楼", price: 450, icon: "https://s1.hdslb.com/bfs/live/59732782e666a877526715f02f8313467f53f31b.png" },
    { name: "小花花", price: 1, icon: "https://s1.hdslb.com/bfs/live/83546377742d3d04085189736c2a472c1c682736.png" }
];
