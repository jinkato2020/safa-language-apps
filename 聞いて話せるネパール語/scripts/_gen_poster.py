# App A(聞いて話せるネパール語, target=ne / 母語=ja[, en])ポスター学習データ生成。
#  「ポスター成果物契約.md」準拠。素材=多言語教材(読取専用):
#    画像: 02_ネパール語教材/02_ポスター/<L1>/<NN_和名>[_pageN]_広告なし_<L1>.png(現状 ja のみ。en は別途)
#    音声: ne(target)=00_共通/音声/_正規化/NE/<theme>(固有9は 02_ネパール語教材/00_固有/音声/_正規化/NE)
#          ja(母語)=同 JA。数字は <theme>/pageN/ 配下(1-100=5ページ)。
#  生成: expo-app/assets/poster/<key>/{poster_<L1>.png, audio/<NN>_<ne|ja>.mp3, ...}(マスター温存)
#        + src/posterLessons.ts(値=packs-poster-appa zip内キー文字列。require不使用=同梱しない)
#  データ形: card.ja=ターゲット(ne)音声キー / card.l1={母語: 母語音声キー} / imageL1={母語: 画像キー}
#            (画面は 母語→ターゲット で再生。'ja'フィールド名は歴史的に「ターゲットスロット」の意味)
#  音声は 32k mono 24kHz + 末尾0.25s pad へ再エンコード。box はポスター画像から実カード枠検出(解像度非依存)。
import os, re, math, shutil, subprocess
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from PIL import Image

GENBA = r"C:\Users\jwpsa\Documents\desktop\claude\多言語教材"
PROD = os.path.join(GENBA, "02_ネパール語教材")
POSTER_SRC = os.path.join(PROD, "02_ポスター")               # <L1>/<NN_和名>[_pageN]_広告なし_<L1>.png
KYO = os.path.join(GENBA, "00_共通", "音声", "_正規化")        # <LANGDIR>/<theme>(/pageN)/<MM>_<l>.mp3
GU = os.path.join(PROD, "00_固有", "音声", "_正規化")          # 固有9テーマの上書き音声
APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(APP, "expo-app", "assets", "poster")
TS_OUT = os.path.join(APP, "expo-app", "src", "posterLessons.ts")
FFMPEG = shutil.which("ffmpeg") or r"C:\ffmpeg\bin\ffmpeg.exe"

TARGET = "ne"                 # 学習対象(大)
L1S = ["ja", "en"]            # 母語(ja=日本語話者 / en=英語話者)。en素材=共通EN+固有EN+enポスター(2026-06-20整備)
LANGDIR = {"ja": "JA", "ne": "NE", "en": "EN", "bn": "BN", "vi": "VI", "zh": "ZH"}
DETECT_L1 = "ja"              # box検出に使う代表母語ポスター(レイアウトは母語共通)
COLF = [(56 / 2480, 1214 / 2480), (1264 / 2480, 2422 / 2480)]  # カード左右2列(画像幅比・解像度非依存)
def cols_for(W):
    return [(round(a * W), round(b * W)) for a, b in COLF]

# (key, 和名フォルダ)。キーは安定英語スラッグ(出荷後改名禁止)。
# 【ポスターモードはテーマ1〜10まで】(2026-06-19 ユーザー指示)。他モード(フラッシュカード等)は全テーマで別系統(WORD_CATEGORIES)。
# 11〜30(家具家電〜副詞)はポスター素材は揃っているが、ポスターモードには載せない(将来解放可能)。
THEMES = [
    ("family", "01_家族"), ("numbers", "02_数字"), ("body", "03_体"), ("colors", "04_色と形"),
    ("food", "05_食べ物"), ("emotions", "06_感情"), ("buildings", "07_建物"), ("animals", "08_動物"),
    ("stationery", "09_文房具"), ("vehicles", "10_乗り物"),
]
GUYU = {"05_食べ物", "07_建物", "08_動物", "15_生活用品", "16_植物", "17_飲み物", "18_楽器", "20_肉・魚", "30_副詞"}
MULTIPAGE = {"02_数字": 5}    # 複数ページテーマ: 和名→ページ数
TARGET_ONLY = {"02_数字"}     # ターゲット言語音声のみ再生(母語ヘルパー無し)。数字=ネパール語のみ朗読(元設計)。

# 母語別テーマ名。ja=和名(jp_title)、en=英語名。一覧/タイトル音声の表示に使う。
EN_TITLE = {"family": "Family", "numbers": "Numbers", "body": "Body", "colors": "Colors & Shapes",
            "food": "Food", "emotions": "Emotions", "buildings": "Buildings", "animals": "Animals",
            "stationery": "Stationery", "vehicles": "Vehicles"}
def title_for(L1, key, jp):   # ja=和名 / en=英語名(無ければ和名)
    return EN_TITLE.get(key, jp) if L1 == "en" else jp

def audio_base(folder):       # 固有9は固有、他は共通
    return GU if folder in GUYU else KYO

def enc32k(src, dst):
    if os.path.exists(dst):
        return
    r = subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", src,
                        "-ar", "24000", "-ac", "1", "-b:a", "32k", "-map_metadata", "-1",
                        "-af", "apad=pad_dur=0.25", dst], capture_output=True)
    if r.returncode != 0 or not os.path.exists(dst):
        raise RuntimeError("ffmpeg fail " + src + " " + r.stderr.decode("utf-8", "replace")[:200])

def cell_count(audio_dir, lang):
    if not os.path.isdir(audio_dir):
        return 0
    return len([f for f in os.listdir(audio_dir) if re.match(rf"^\d+_{lang}\.mp3$", f)])

def _group_lines(frac, H, th, top, bot, gap):
    lines = [y for y in range(top, H - bot) if frac[y] > th]
    g = []
    for v in lines:
        if g and v - g[-1][-1] <= gap: g[-1].append(v)
        else: g.append([v])
    return [sum(x) // len(x) for x in g]

def detect_rows(png, R):
    a = np.asarray(Image.open(png).convert("RGB")).astype(int)
    H, W = a.shape[0], a.shape[1]
    col = cols_for(W)
    # カード枠のクリーム色(#d9cfb6≈217,207,182)で横罫線を検出。黒い数字/文字に干渉されないため
    #  図形テーマ(numbers/colors/time=大数字や塗り)でも語彙テーマでも一様に効く(実測で全テーマ2R一致)。
    Rc, Gc, Bc = a[..., 0], a[..., 1], a[..., 2]
    # カード枠のグレー(#e6e8ec≈230,232,236)で横罫線を検出(2026-06-19 新レイアウト=枠グレー化に追従)。
    #  黒い数字/文字や塗りに干渉されない=図形(numbers/colors)でも語彙でも一様に2R本検出(実測で全テーマ一致)。
    border = (np.abs(Rc - 230) < 14) & (np.abs(Gc - 232) < 14) & (np.abs(Bc - 236) < 14)
    frac = border[:, col[0][0]:col[0][1]].mean(axis=1)
    # bot=12: 最下カードの下罫線が画像下端(≈18px)に近く、大きいと切れて2R-1本になるため小さく取る(実測)。
    top = round(110 * H / 1754); bot = round(12 * H / 1754); gap = max(2, round(5 * W / 2480))
    chosen = None
    for i in range(26):
        th = round(0.30 + 0.02 * i, 2)   # 0.30..0.80(グレー枠は信号が明瞭)
        c = _group_lines(frac, H, th, top, bot, gap)
        if len(c) == 2 * R: chosen = c; break
        if chosen is None and len(c) >= 2 * R: chosen = c[:2 * R]
    if chosen is None:
        raise RuntimeError(f"{os.path.basename(png)}: 枠線を 2R={2*R} 本にできず(W={W} H={H})")
    return [(chosen[2 * k], chosen[2 * k + 1]) for k in range(R)], W, H

def boxes_for(png, n):
    R = math.ceil(n / 2)
    rows, W, H = detect_rows(png, R)
    col = cols_for(W)
    out = []
    for i in range(n):
        ci, ri = (0, i) if i < R else (1, i - R)
        x, x2 = col[ci]; top, bot = rows[ri]
        out.append({"i": i, "x": x, "y": top, "w": x2 - x, "h": bot - top})
    return out, W, H

def jp_title(folder):
    return re.sub(r"^\d+_", "", folder)

def build_page(key, folder, sub, png, dst_dir, tasks):
    """1ページ分を構築。sub='' は単一ページ、'page1' 等は数字。戻り: page dict。"""
    abase = audio_base(folder)
    def _adir(LD): return os.path.join(abase, LD, folder, sub) if sub else os.path.join(abase, LD, folder)
    aud_src_ne = _adir("NE")
    n = cell_count(aud_src_ne, "ne")
    if n == 0:
        raise RuntimeError(f"{key}/{folder}/{sub}: ne 音声なし")
    # 母語ヘルパー音声: targetOnly(数字)はヘルパー無し(neのみ朗読)。それ以外は L1S 各言語=件数が ne と一致必須。
    helpers = [] if folder in TARGET_ONLY else list(L1S)
    for L1 in helpers:
        c = cell_count(_adir(LANGDIR[L1]), L1)
        if c != n:
            raise RuntimeError(f"{key}/{folder}/{sub}: {L1} 音声数不一致 (ne={n}, {L1}={c})")
    aud_dir = os.path.join(dst_dir, "audio")
    os.makedirs(aud_dir, exist_ok=True)
    pref = f"{key}/{sub}" if sub else key
    # 音声: ne(target) + 各ヘルパー(ja/en)。ページは別keyフォルダ。
    for L, src in [(TARGET, aud_src_ne)] + [(L1, _adir(LANGDIR[L1])) for L1 in helpers]:
        for k in range(1, n + 1):
            tasks.append((os.path.join(src, f"{k:02d}_{L}.mp3"), os.path.join(aud_dir, f"{k:02d}_{L}.mp3")))
        ts = os.path.join(src, f"title_{L}.mp3")
        if os.path.exists(ts):
            tasks.append((ts, os.path.join(aud_dir, f"title_{L}.mp3")))
    bx, W, H = boxes_for(png, n)
    has_title = os.path.exists(os.path.join(aud_dir, f"title_{TARGET}.mp3"))
    # 画像コピー(母語別)。各母語ポスターは POSTER_SRC/<L1>/ 配下にある。
    #  ※以前は ja パスの末尾 _ja→_en 置換だけで /ja/ ディレクトリのままになり en画像を取りこぼす不具合があった
    #    (→英語で真っ白)。ディレクトリも母語別に組み立てて確実にコピーする。
    base = f"{folder}_{sub}_広告なし" if sub else f"{folder}_広告なし"
    for L1 in L1S:
        src_png = os.path.join(POSTER_SRC, L1, f"{base}_{L1}.png")
        if os.path.exists(src_png):
            shutil.copyfile(src_png, os.path.join(dst_dir, f"poster_{L1}.png"))
        elif L1 == DETECT_L1:
            raise RuntimeError(f"{key}/{folder}/{sub}: 代表母語画像なし {src_png}")
    return {"pref": pref, "n": n, "boxes": bx, "W": W, "H": H, "has_title": has_title}

def main():
    lessons = []; tasks = []; skipped = []
    for key, folder in THEMES:
        try:
            title = jp_title(folder)
            if folder in MULTIPAGE:
                pages = []
                for p in range(1, MULTIPAGE[folder] + 1):
                    png = os.path.join(POSTER_SRC, DETECT_L1, f"{folder}_page{p}_広告なし_{DETECT_L1}.png")
                    if not os.path.exists(png):
                        raise RuntimeError(f"{os.path.basename(png)} 無し")
                    dst_dir = os.path.join(ASSETS, key, f"page{p}")
                    pages.append(build_page(key, folder, f"page{p}", png, dst_dir, tasks))
                lessons.append({"key": key, "title": title, "pages": pages, "multi": True, "target_only": folder in TARGET_ONLY})
                print(f"  {key}: {MULTIPAGE[folder]}ページ ({sum(pg['n'] for pg in pages)}カード)", flush=True)
            else:
                png = os.path.join(POSTER_SRC, DETECT_L1, f"{folder}_広告なし_{DETECT_L1}.png")
                if not os.path.exists(png):
                    raise RuntimeError(f"{os.path.basename(png)} 無し")
                dst_dir = os.path.join(ASSETS, key)
                pg = build_page(key, folder, "", png, dst_dir, tasks)
                lessons.append({"key": key, "title": title, "pages": [pg], "multi": False, "target_only": folder in TARGET_ONLY})
                print(f"  {key}: {pg['n']}カード ({pg['W']}x{pg['H']})", flush=True)
        except Exception as e:
            skipped.append(key); print(f"  [SKIP] {key}: {str(e)[:90]}", flush=True)
    print(f"音声再エンコード {len(tasks)}件(32k+0.25s pad)...", flush=True)
    with ThreadPoolExecutor(max_workers=10) as ex:
        list(ex.map(lambda t: enc32k(*t), tasks))

    def page_obj(pg):
        # 1ページ分のTSオブジェクト文字列。pref=zipキー接頭辞(例 'numbers/page1' or 'family')
        pr = pg["pref"]
        img = ", ".join([f"{L1}:'{pr}/poster_{L1}.png'" for L1 in L1S])
        ta = (f"titleAudio:{{ ja:'{pr}/audio/title_{TARGET}.mp3', "
              f"l1:{{ {', '.join([f'{L1}:'+chr(39)+pr+'/audio/title_'+L1+'.mp3'+chr(39) for L1 in L1S])} }} }}, ") if pg["has_title"] else ""
        cards = []
        for b in pg["boxes"]:
            k = b["i"] + 1
            l1 = ", ".join([f"{L1}:'{pr}/audio/{k:02d}_{L1}.mp3'" for L1 in L1S])
            cards.append(f"   {{ i:{b['i']}, box:{{x:{b['x']},y:{b['y']},w:{b['w']},h:{b['h']}}}, "
                         f"ja:'{pr}/audio/{k:02d}_{TARGET}.mp3', l1:{{ {l1} }} }},")
        return (f"{{ imageL1:{{ {img} }}, {ta}posterW:{pg['W']}, posterH:{pg['H']}, cards:[\n"
                + "\n".join(cards) + "\n   ] }")

    L = ["// 自動生成 (scripts/_gen_poster.py)。素材=多言語教材(ポスター成果物契約.md準拠): 02_ネパール語教材/02_ポスター + 00_共通・固有/音声/_正規化",
         "// App A: target=ne(大)/母語=ja[,en]。値は packs-poster-appa zip内キー。card.ja=ターゲット(ne)音声 / card.l1=母語音声 / imageL1=母語別画像。",
         "// numbers は pages[](1-100=5ページ・スワイプ)。file://解決は posterPackLoader。",
         "export type PosterCard = { i: number; box: { x: number; y: number; w: number; h: number }; ja: string; l1: Record<string, string> };",
         "export type PosterPage = { image?: string; imageL1?: Record<string, string>; titleAudio?: { ja: string; l1: Record<string, string> }; posterW: number; posterH: number; cards: PosterCard[] };",
         "export type PosterLesson = { id: string; title: string; titleL1: Record<string, string>; titleNp?: string; imageL1?: Record<string, string>; titleAudio?: { ja: string; l1: Record<string, string> }; posterW?: number; posterH?: number; cards?: PosterCard[]; pages?: PosterPage[]; targetOnly?: boolean };",
         "", "export const POSTER_LESSONS: PosterLesson[] = ["]
    for ls in lessons:
        key = ls["key"]; title = ls["title"]
        tl1 = ", ".join([f"{L1}:'{title_for(L1, key, title)}'" for L1 in L1S])  # ja=和名 / en=英語名
        if ls["multi"]:
            pages_str = ",\n  ".join(page_obj(pg) for pg in ls["pages"])
            L.append(f" {{ id:'{key}', title:'{title}', titleL1:{{ {tl1} }},{' targetOnly:true,' if ls.get('target_only') else ''} pages:[\n  {pages_str}\n ] }},")
        else:
            pg = ls["pages"][0]; pr = pg["pref"]
            img = ", ".join([f"{L1}:'{pr}/poster_{L1}.png'" for L1 in L1S])
            ta = (f"titleAudio:{{ ja:'{pr}/audio/title_{TARGET}.mp3', l1:{{ {', '.join([f'{L1}:'+chr(39)+pr+'/audio/title_'+L1+'.mp3'+chr(39) for L1 in L1S])} }} }}, ") if pg["has_title"] else ""
            cards = []
            for b in pg["boxes"]:
                k = b["i"] + 1
                l1 = ", ".join([f"{L1}:'{pr}/audio/{k:02d}_{L1}.mp3'" for L1 in L1S])
                cards.append(f"   {{ i:{b['i']}, box:{{x:{b['x']},y:{b['y']},w:{b['w']},h:{b['h']}}}, ja:'{pr}/audio/{k:02d}_{TARGET}.mp3', l1:{{ {l1} }} }},")
            L.append(f" {{ id:'{key}', title:'{title}', titleL1:{{ {tl1} }},{' targetOnly:true,' if ls.get('target_only') else ''} imageL1:{{ {img} }}, {ta}posterW:{pg['W']}, posterH:{pg['H']},")
            L.append("   cards:[")
            L.extend(cards)
            L.append("   ] },")
    L.append("];")
    with open(TS_OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(L) + "\n")
    print("posterLessons.ts 生成:", TS_OUT, f"({len(lessons)}テーマ)")
    if skipped:
        print("【要対応】box検出失敗等でスキップ:", skipped)

if __name__ == "__main__":
    main()
