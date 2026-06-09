// 自動生成 (scripts/gen-poster-data.mjs)。ポスター音声学習データ。
export type PosterCard = { i: number; box: { x: number; y: number; w: number; h: number }; ja: number; ne: number; ill: number; word: string; kana: string; romaji: string; np: string };
export type PosterLesson = { id: string; title: string; titleNp: string; image: number; posterW: number; posterH: number; cards: PosterCard[] };

export const POSTER_LESSONS: PosterLesson[] = [
 {
  id: 'family', title: '家族', titleNp: 'परिवार',
  image: require('../assets/poster/family/poster.png'),
  posterW: 2480, posterH: 3508,
  cards: [
  { i:0, box:{x:100,y:464,w:1114,h:276}, ja:require('../assets/poster/family/audio/01_ja.mp3'), ne:require('../assets/poster/family/audio/01_ne.mp3'), ill:require('../assets/poster/family/illust/01_kazoku.png'), word:"家族", kana:"かぞく", romaji:"kazoku", np:"परिवार" },
  { i:1, box:{x:100,y:758,w:1114,h:276}, ja:require('../assets/poster/family/audio/02_ja.mp3'), ne:require('../assets/poster/family/audio/02_ne.mp3'), ill:require('../assets/poster/family/illust/02_ryoshin.png'), word:"両親", kana:"りょうしん", romaji:"ryōshin", np:"आमाबुबा" },
  { i:2, box:{x:100,y:1052,w:1114,h:276}, ja:require('../assets/poster/family/audio/03_ja.mp3'), ne:require('../assets/poster/family/audio/03_ne.mp3'), ill:require('../assets/poster/family/illust/03_chichi.png'), word:"父", kana:"ちち", romaji:"chichi", np:"बुबा" },
  { i:3, box:{x:100,y:1346,w:1114,h:276}, ja:require('../assets/poster/family/audio/04_ja.mp3'), ne:require('../assets/poster/family/audio/04_ne.mp3'), ill:require('../assets/poster/family/illust/04_otosan.png'), word:"お父さん", kana:"おとうさん", romaji:"otōsan", np:"बुबा" },
  { i:4, box:{x:100,y:1640,w:1114,h:276}, ja:require('../assets/poster/family/audio/05_ja.mp3'), ne:require('../assets/poster/family/audio/05_ne.mp3'), ill:require('../assets/poster/family/illust/05_haha.png'), word:"母", kana:"はは", romaji:"haha", np:"आमा" },
  { i:5, box:{x:100,y:1934,w:1114,h:276}, ja:require('../assets/poster/family/audio/06_ja.mp3'), ne:require('../assets/poster/family/audio/06_ne.mp3'), ill:require('../assets/poster/family/illust/06_okasan.png'), word:"お母さん", kana:"おかあさん", romaji:"okāsan", np:"आमा" },
  { i:6, box:{x:100,y:2228,w:1114,h:276}, ja:require('../assets/poster/family/audio/07_ja.mp3'), ne:require('../assets/poster/family/audio/07_ne.mp3'), ill:require('../assets/poster/family/illust/07_ani.png'), word:"兄", kana:"あに", romaji:"ani", np:"दाइ" },
  { i:7, box:{x:100,y:2522,w:1114,h:276}, ja:require('../assets/poster/family/audio/08_ja.mp3'), ne:require('../assets/poster/family/audio/08_ne.mp3'), ill:require('../assets/poster/family/illust/08_ane.png'), word:"姉", kana:"あね", romaji:"ane", np:"दिदी" },
  { i:8, box:{x:100,y:2816,w:1114,h:276}, ja:require('../assets/poster/family/audio/09_ja.mp3'), ne:require('../assets/poster/family/audio/09_ne.mp3'), ill:require('../assets/poster/family/illust/09_otouto.png'), word:"弟", kana:"おとうと", romaji:"otōto", np:"भाइ" },
  { i:9, box:{x:100,y:3110,w:1114,h:276}, ja:require('../assets/poster/family/audio/10_ja.mp3'), ne:require('../assets/poster/family/audio/10_ne.mp3'), ill:require('../assets/poster/family/illust/10_imouto.png'), word:"妹", kana:"いもうと", romaji:"imōto", np:"बहिनी" },
  { i:10, box:{x:1266,y:464,w:1114,h:276}, ja:require('../assets/poster/family/audio/11_ja.mp3'), ne:require('../assets/poster/family/audio/11_ne.mp3'), ill:require('../assets/poster/family/illust/11_kyodai.png'), word:"兄弟", kana:"きょうだい", romaji:"kyōdai", np:"दाजुभाइ" },
  { i:11, box:{x:1266,y:758,w:1114,h:276}, ja:require('../assets/poster/family/audio/12_ja.mp3'), ne:require('../assets/poster/family/audio/12_ne.mp3'), ill:require('../assets/poster/family/illust/12_sofu.png'), word:"祖父", kana:"そふ", romaji:"sofu", np:"हजुरबुबा" },
  { i:12, box:{x:1266,y:1052,w:1114,h:276}, ja:require('../assets/poster/family/audio/13_ja.mp3'), ne:require('../assets/poster/family/audio/13_ne.mp3'), ill:require('../assets/poster/family/illust/13_sobo.png'), word:"祖母", kana:"そぼ", romaji:"sobo", np:"हजुरआमा" },
  { i:13, box:{x:1266,y:1346,w:1114,h:276}, ja:require('../assets/poster/family/audio/14_ja.mp3'), ne:require('../assets/poster/family/audio/14_ne.mp3'), ill:require('../assets/poster/family/illust/14_otto.png'), word:"夫", kana:"おっと", romaji:"otto", np:"श्रीमान्" },
  { i:14, box:{x:1266,y:1640,w:1114,h:276}, ja:require('../assets/poster/family/audio/15_ja.mp3'), ne:require('../assets/poster/family/audio/15_ne.mp3'), ill:require('../assets/poster/family/illust/15_tsuma.png'), word:"妻", kana:"つま", romaji:"tsuma", np:"श्रीमती" },
  { i:15, box:{x:1266,y:1934,w:1114,h:276}, ja:require('../assets/poster/family/audio/16_ja.mp3'), ne:require('../assets/poster/family/audio/16_ne.mp3'), ill:require('../assets/poster/family/illust/16_musuko.png'), word:"息子", kana:"むすこ", romaji:"musuko", np:"छोरा" },
  { i:16, box:{x:1266,y:2228,w:1114,h:276}, ja:require('../assets/poster/family/audio/17_ja.mp3'), ne:require('../assets/poster/family/audio/17_ne.mp3'), ill:require('../assets/poster/family/illust/17_musume.png'), word:"娘", kana:"むすめ", romaji:"musume", np:"छोरी" },
  { i:17, box:{x:1266,y:2522,w:1114,h:276}, ja:require('../assets/poster/family/audio/18_ja.mp3'), ne:require('../assets/poster/family/audio/18_ne.mp3'), ill:require('../assets/poster/family/illust/18_kodomo.png'), word:"子ども", kana:"こども", romaji:"kodomo", np:"बच्चा" },
  { i:18, box:{x:1266,y:2816,w:1114,h:276}, ja:require('../assets/poster/family/audio/19_ja.mp3'), ne:require('../assets/poster/family/audio/19_ne.mp3'), ill:require('../assets/poster/family/illust/19_mago.png'), word:"孫", kana:"まご", romaji:"mago", np:"नाति/नातिनी" },
  { i:19, box:{x:1266,y:3110,w:1114,h:276}, ja:require('../assets/poster/family/audio/20_ja.mp3'), ne:require('../assets/poster/family/audio/20_ne.mp3'), ill:require('../assets/poster/family/illust/20_akachan.png'), word:"赤ちゃん", kana:"あかちゃん", romaji:"akachan", np:"बच्चा/शिशु" },
  ],
 },
];
