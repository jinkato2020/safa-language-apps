# ポスター音声学習データ生成(自己完結): 02日本語教材/{2_ポスター,3_音声/_正規化} のみを入力に生成。
#  - 広告なしポスター(bn/en/ne/vi)と正規化音声(ja+4言語)+title を assets へ
#  - 音声は 32k/24kHz mono へ再エンコード+末尾に0.25s無音pad(末尾切れ防止)
#  - box座標は ne ポスター画像から実カード枠を検出(縦:テンプレ定数 / 横罫線:行検出)
#  - posterLessons.ts を生成(imageL1 / card.l1 / ja / titleAudio)
import os, re, math, shutil, subprocess
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from PIL import Image
# === 「ポスター成果物契約.md」(リポジトリ直下)準拠 ===
# App B(target=ja): 教材ルート=多言語教材/01_日本語教材, 共通音声=多言語教材/00_共通/音声/_正規化
GENBA = r"C:\Users\jwpsa\Documents\desktop\claude\多言語教材"
POSTER_SRC = os.path.join(GENBA, "01_日本語教材", "02_ポスター")   # <L1>/<NN>_<和名>_広告なし_<L1>.png
AUDIO_SRC = os.path.join(GENBA, "00_共通", "音声", "_正規化")       # <LANGDIR>/<NN>_<和名>/<MM>_<L>.mp3
APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(APP, "expo-app", "assets", "poster")
TS_OUT = os.path.join(APP, "expo-app", "src", "posterLessons.ts")
FFMPEG = shutil.which("ffmpeg") or r"C:\ffmpeg\bin\ffmpeg.exe"
LANGS = ["bn", "en", "ne", "vi", "zh"]   # App B 母語(ko未生成: 契約§5)
ALL = ["ja"] + LANGS
LANGDIR = {"ja": "JA", "bn": "BN", "en": "EN", "ne": "NE", "vi": "VI", "zh": "ZH"}
DETECT_L1 = "ne"   # box検出に使う代表L1(行レイアウトは全L1共通)
# カード左右2列の x 範囲は画像幅に対する比率で保持(解像度非依存)。基準2480pxでの実測 56/1214/1264/2422。
# 教材が2480→1240(WEBサイズ)へ変わっても比率で自動追従する。posterW/H も実画像から取得。
COLF = [(56 / 2480, 1214 / 2480), (1264 / 2480, 2422 / 2480)]
def cols_for(W):
    return [(round(a * W), round(b * W)) for a, b in COLF]
THEMES = [("family", "01_家族"), ("numbers", "02_数字"), ("body", "03_体"),
          ("colors", "04_色と形"), ("food", "05_食べ物"), ("emotions", "06_感情"),
          ("buildings", "07_建物"), ("animals", "08_動物"), ("stationery", "09_文房具"),
          ("vehicles", "10_乗り物")]

# テーマタイトルの母語訳(一覧は母語のみ表示)。順序 ja,bn,en,ne,vi,zh
TITLE_L1 = {
 "family":   {"ja":"家族","bn":"পরিবার","en":"Family","ne":"परिवार","vi":"Gia đình","zh":"家庭"},
 "numbers":  {"ja":"数字","bn":"সংখ্যা","en":"Numbers","ne":"अङ्क","vi":"Con số","zh":"数字"},
 "body":     {"ja":"体","bn":"শরীর","en":"Body","ne":"शरीर","vi":"Cơ thể","zh":"身体"},
 "colors":   {"ja":"色と形","bn":"রং ও আকৃতি","en":"Colors & Shapes","ne":"रङ र आकार","vi":"Màu sắc & Hình dạng","zh":"颜色与形状"},
 "food":     {"ja":"食べ物","bn":"খাবার","en":"Food","ne":"खाना","vi":"Thức ăn","zh":"食物"},
 "emotions": {"ja":"感情","bn":"আবেগ","en":"Emotions","ne":"भावना","vi":"Cảm xúc","zh":"情感"},
 "buildings":{"ja":"建物","bn":"ভবন","en":"Buildings","ne":"भवन","vi":"Tòa nhà","zh":"建筑"},
 "animals":  {"ja":"動物","bn":"প্রাণী","en":"Animals","ne":"जनावर","vi":"Động vật","zh":"动物"},
 "stationery":{"ja":"文房具","bn":"লেখার সামগ্রী","en":"Stationery","ne":"लेखन सामग्री","vi":"Văn phòng phẩm","zh":"文具"},
 "vehicles": {"ja":"乗り物","bn":"যানবাহন","en":"Vehicles","ne":"सवारी साधन","vi":"Phương tiện","zh":"交通工具"},
}

def enc32k(src, dst):
    if os.path.exists(dst):
        return
    r = subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", src,
                        "-ar", "24000", "-ac", "1", "-b:a", "32k", "-map_metadata", "-1",
                        "-af", "apad=pad_dur=0.25", dst], capture_output=True)
    if r.returncode != 0 or not os.path.exists(dst):
        raise RuntimeError("ffmpeg fail " + src + " " + r.stderr.decode("utf-8", "replace")[:200])

def cell_count(folder):
    d = os.path.join(AUDIO_SRC, "JA", folder)
    return len([f for f in os.listdir(d) if re.match(r"^\d+_ja\.mp3$", f)])

def _group_lines(frac, H, th, top, bot, gap):
    lines = [y for y in range(top, H - bot) if frac[y] > th]
    g = []
    for v in lines:
        if g and v - g[-1][-1] <= gap: g[-1].append(v)
        else: g.append([v])
    return [sum(x) // len(x) for x in g]

def detect_rows(folder, R):
    png = os.path.join(POSTER_SRC, DETECT_L1, f"{folder}_広告なし_{DETECT_L1}.png")
    a = np.asarray(Image.open(png).convert("RGB")).astype(int)
    H, W = a.shape[0], a.shape[1]
    col = cols_for(W)
    Rc, Gc, Bc = a[..., 0], a[..., 1], a[..., 2]
    # カード枠のグレー(#e6e8ec≈230,232,236)で横罫線を検出(2026-06-19 新レイアウト=フッター削除/ヘッダー詰め/枠グレー化に追従)。
    #  旧 nonwhite 検出はタイトル文字やイラストを誤検出し、かつヘッダー詰めでカード先頭(y≈156)が旧上マージン(200)に隠れる不具合があった。
    #  グレー枠だけを拾えば図形(numbers/colors)でも語彙でも一様に 2R 本(=R行×上下)検出できる(実測一致)。
    border = (np.abs(Rc - 230) < 14) & (np.abs(Gc - 232) < 14) & (np.abs(Bc - 236) < 14)
    frac = border[:, col[0][0]:col[0][1]].mean(axis=1)   # 左カード幅でのグレー横罫線検出
    # bot=12: 最下カードの下罫線が画像下端(≈18px)に近く、大きいと切れて2R-1本になるため小さく取る(実測)。
    top = round(110 * H / 1754); bot = round(12 * H / 1754); gap = max(2, round(5 * W / 2480))
    # 適応しきい値: ちょうど 2*R 本になる最小しきい値を採用(グレー枠は信号が明瞭)。
    chosen = None
    for i in range(26):
        th = round(0.30 + 0.02 * i, 2)
        c = _group_lines(frac, H, th, top, bot, gap)
        if len(c) == 2 * R: chosen = c; break
        if chosen is None and len(c) >= 2 * R: chosen = c[:2 * R]  # 保険(最初に多すぎた場合)
    if chosen is None:
        raise RuntimeError(f"{folder}: 横罫線を 2R={2*R} 本にできず(W={W} H={H})")
    c = chosen
    return [(c[2 * k], c[2 * k + 1]) for k in range(R)], W, H   # (top, bottom) × R, 実画像サイズ

def boxes(n, folder):
    R = math.ceil(n / 2)
    rows, W, H = detect_rows(folder, R)
    col = cols_for(W)
    out = []
    for i in range(n):
        ci, ri = (0, i) if i < R else (1, i - R)
        x, x2 = col[ci]; top, bot = rows[ri]
        out.append({"i": i, "x": x, "y": top, "w": x2 - x, "h": bot - top})
    return out, W, H

def jp_title(folder):
    return re.sub(r"^\d+_", "", folder)

def main():
    lessons = []; tasks = []
    for lid, folder in THEMES:
        # 契約整合チェック: 単一ページの広告なしポスターが無いテーマ(numbers=5ページ等)は
        # 教材側と本体側で成果物が異なる(本体numbersは代表20数の単一ポスター)。盲目的再生成を防ぐ。
        probe = os.path.join(POSTER_SRC, DETECT_L1, f"{folder}_広告なし_{DETECT_L1}.png")
        if not os.path.exists(probe):
            raise SystemExit(f"[契約不一致] {lid}/{folder}: 単一ページ {os.path.basename(probe)} が無い。"
                             f" 複数ページ/特殊テーマは未対応(ポスター成果物契約.md §2/§5)。"
                             f" pagination/curation を実装するまで THEMES から外すこと。")
        n = cell_count(folder)
        dst_dir = os.path.join(ASSETS, lid); aud_dir = os.path.join(dst_dir, "audio")
        os.makedirs(aud_dir, exist_ok=True)
        for L in LANGS:
            src_png = os.path.join(POSTER_SRC, L, f"{folder}_広告なし_{L}.png")
            shutil.copyfile(src_png, os.path.join(dst_dir, f"poster_{L}.png"))
        for L in ALL:
            for k in range(1, n + 1):
                tasks.append((os.path.join(AUDIO_SRC, LANGDIR[L], folder, f"{k:02d}_{L}.mp3"),
                              os.path.join(aud_dir, f"{k:02d}_{L}.mp3")))
            ts = os.path.join(AUDIO_SRC, LANGDIR[L], folder, f"title_{L}.mp3")
            if os.path.exists(ts):
                tasks.append((ts, os.path.join(aud_dir, f"title_{L}.mp3")))
        bx, W, H = boxes(n, folder)
        lessons.append({"id": lid, "title": jp_title(folder), "boxes": bx, "n": n, "W": W, "H": H})
        print(f"  {lid}: {n}cells +title, boxes検出OK ({W}x{H})", flush=True)
    print(f"音声再エンコード {len(tasks)}件(32k+0.25s pad)...", flush=True)
    with ThreadPoolExecutor(max_workers=10) as ex:
        list(ex.map(lambda t: enc32k(*t), tasks))

    # posterLessons.ts の値は packs-poster zip 内エントリのキー文字列(同梱でなくDL)。
    #  file:// 解決は posterPackLoader(posterUri)。require は使わない(Metro同梱を避ける=同梱除外)。
    L = ["// 自動生成 (scripts/_gen_poster.py)。素材=多言語教材(ポスター成果物契約.md準拠): 01_日本語教材/02_ポスター + 00_共通/音声/_正規化",
         "// box=ポスター画像から実カード枠を検出。imageL1/card.l1/ja/titleAudio。音声は末尾0.25s pad付。",
         "// 値は packs-poster zip内エントリのキー(例 'family/audio/01_ja.mp3')。file://解決は posterPackLoader。",
         "export type PosterCard = { i: number; box: { x: number; y: number; w: number; h: number }; ja: string; l1: Record<string, string> };",
         "export type PosterLesson = { id: string; title: string; titleL1: Record<string, string>; titleNp?: string; imageL1: Record<string, string>; titleAudio?: { ja: string; l1: Record<string, string> }; posterW: number; posterH: number; cards: PosterCard[] };",
         "", "export const POSTER_LESSONS: PosterLesson[] = ["]
    for ls in lessons:
        lid = ls["id"]
        img = ", ".join([f"{l}:'{lid}/poster_{l}.png'" for l in LANGS])
        tl1 = ", ".join([f"{l}:'{lid}/audio/title_{l}.mp3'" for l in LANGS])
        tl = TITLE_L1[lid]
        tlstr = ", ".join([f"{k}:'{tl[k]}'" for k in ['ja','bn','en','ne','vi','zh']])
        L.append(f" {{ id:'{lid}', title:'{ls['title']}', titleL1:{{ {tlstr} }}, posterW:{ls['W']}, posterH:{ls['H']},")
        L.append(f"   imageL1:{{ {img} }},")
        L.append(f"   titleAudio:{{ ja:'{lid}/audio/title_ja.mp3', l1:{{ {tl1} }} }},")
        L.append("   cards:[")
        for b in ls["boxes"]:
            k = b["i"] + 1
            ja = f"'{lid}/audio/{k:02d}_ja.mp3'"
            l1 = ", ".join([f"{l}:'{lid}/audio/{k:02d}_{l}.mp3'" for l in LANGS])
            L.append(f"   {{ i:{b['i']}, box:{{x:{b['x']},y:{b['y']},w:{b['w']},h:{b['h']}}}, ja:{ja}, l1:{{ {l1} }} }},")
        L.append("   ] },")
    L.append("];")
    with open(TS_OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(L) + "\n")
    print("posterLessons.ts 生成:", TS_OUT)

if __name__ == "__main__":
    main()
