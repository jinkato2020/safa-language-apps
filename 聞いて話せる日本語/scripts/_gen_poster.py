# ポスター音声学習データ生成(自己完結): 02日本語教材/{2_ポスター,3_音声/_正規化} のみを入力に生成。
#  - 広告なしポスター(bn/en/ne/vi)と正規化音声(ja+4言語)+title を assets へ
#  - 音声は 32k/24kHz mono へ再エンコード+末尾に0.25s無音pad(末尾切れ防止)
#  - box座標は ne ポスター画像から実カード枠を検出(縦:テンプレ定数 / 横罫線:行検出)
#  - posterLessons.ts を生成(imageL1 / card.l1 / ja / titleAudio)
import os, re, math, shutil, subprocess
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from PIL import Image
SRC = r"C:\Users\jwpsa\Documents\desktop\claude\02日本語教材"
POSTER_SRC = os.path.join(SRC, "2_ポスター")
AUDIO_SRC = os.path.join(SRC, "3_音声", "_正規化")
APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(APP, "expo-app", "assets", "poster")
TS_OUT = os.path.join(APP, "expo-app", "src", "posterLessons.ts")
FFMPEG = shutil.which("ffmpeg") or r"C:\ffmpeg\bin\ffmpeg.exe"
LANGS = ["bn", "en", "ne", "vi", "zh"]
ALL = ["ja"] + LANGS
LANGDIR = {"ja": "JA", "bn": "BN", "en": "EN", "ne": "NE", "vi": "VI", "zh": "ZH"}
POSTER_W, POSTER_H = 2480, 3508
COL = [(56, 1214), (1264, 2422)]   # 実測カード左右端(テンプレ共通) (x, x2)
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

def _group_lines(frac, H, th):
    lines = [y for y in range(400, H - 80) if frac[y] > th]
    g = []
    for v in lines:
        if g and v - g[-1][-1] <= 5: g[-1].append(v)
        else: g.append([v])
    return [sum(x) // len(x) for x in g]

def detect_rows(folder, R):
    png = os.path.join(POSTER_SRC, "ne", f"{folder}_広告なし_ne.png")
    a = np.asarray(Image.open(png).convert("RGB")).astype(int)
    nonwhite = (a.min(axis=2) < 248)
    frac = nonwhite[:, COL[0][0]:COL[0][1]].mean(axis=1)   # 左カード幅での横罫線検出
    H = a.shape[0]
    # 適応しきい値: ちょうど 2*R 本の横罫線になる最小しきい値を採用。
    #  0.6 固定だと一部テーマ(buildings/vehicles)で card内イラスト(幅60-70%)を
    #  誤検出し余分な線が混入→下段のペアリングがズレる。0.6→1.0 を走査して
    #  きっかり 2*R 本になる値を選ぶ。
    chosen = None
    for i in range(21):
        th = round(0.60 + 0.02 * i, 2)
        c = _group_lines(frac, H, th)
        if len(c) == 2 * R: chosen = c; break
        if chosen is None and len(c) >= 2 * R: chosen = c[:2 * R]  # 保険(最初に多すぎた場合)
    if chosen is None:
        raise RuntimeError(f"{folder}: 横罫線を 2R={2*R} 本にできず")
    c = chosen
    return [(c[2 * k], c[2 * k + 1]) for k in range(R)]   # (top, bottom) × R

def boxes(n, folder):
    R = math.ceil(n / 2)
    rows = detect_rows(folder, R)
    out = []
    for i in range(n):
        col, ri = (0, i) if i < R else (1, i - R)
        x, x2 = COL[col]; top, bot = rows[ri]
        out.append({"i": i, "x": x, "y": top, "w": x2 - x, "h": bot - top})
    return out

def jp_title(folder):
    return re.sub(r"^\d+_", "", folder)

def main():
    lessons = []; tasks = []
    for lid, folder in THEMES:
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
        lessons.append({"id": lid, "title": jp_title(folder), "boxes": boxes(n, folder), "n": n})
        print(f"  {lid}: {n}cells +title, boxes検出OK", flush=True)
    print(f"音声再エンコード {len(tasks)}件(32k+0.25s pad)...", flush=True)
    with ThreadPoolExecutor(max_workers=10) as ex:
        list(ex.map(lambda t: enc32k(*t), tasks))

    rel = "../assets/poster"
    L = ["// 自動生成 (scripts/_gen_poster.py)。素材: 02日本語教材/{2_ポスター,3_音声/_正規化}",
         "// box=ポスター画像から実カード枠を検出。imageL1/card.l1/ja/titleAudio。音声は末尾0.25s pad付。",
         "export type PosterCard = { i: number; box: { x: number; y: number; w: number; h: number }; ja: number; l1: Record<string, number> };",
         "export type PosterLesson = { id: string; title: string; titleL1: Record<string, string>; titleNp?: string; imageL1: Record<string, number>; titleAudio?: { ja: number; l1: Record<string, number> }; posterW: number; posterH: number; cards: PosterCard[] };",
         "", "export const POSTER_LESSONS: PosterLesson[] = ["]
    for ls in lessons:
        lid = ls["id"]
        img = ", ".join([f"{l}:require('{rel}/{lid}/poster_{l}.png')" for l in LANGS])
        tl1 = ", ".join([f"{l}:require('{rel}/{lid}/audio/title_{l}.mp3')" for l in LANGS])
        tl = TITLE_L1[lid]
        tlstr = ", ".join([f"{k}:'{tl[k]}'" for k in ['ja','bn','en','ne','vi','zh']])
        L.append(f" {{ id:'{lid}', title:'{ls['title']}', titleL1:{{ {tlstr} }}, posterW:{POSTER_W}, posterH:{POSTER_H},")
        L.append(f"   imageL1:{{ {img} }},")
        L.append(f"   titleAudio:{{ ja:require('{rel}/{lid}/audio/title_ja.mp3'), l1:{{ {tl1} }} }},")
        L.append("   cards:[")
        for b in ls["boxes"]:
            k = b["i"] + 1
            ja = f"require('{rel}/{lid}/audio/{k:02d}_ja.mp3')"
            l1 = ", ".join([f"{l}:require('{rel}/{lid}/audio/{k:02d}_{l}.mp3')" for l in LANGS])
            L.append(f"   {{ i:{b['i']}, box:{{x:{b['x']},y:{b['y']},w:{b['w']},h:{b['h']}}}, ja:{ja}, l1:{{ {l1} }} }},")
        L.append("   ] },")
    L.append("];")
    with open(TS_OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(L) + "\n")
    print("posterLessons.ts 生成:", TS_OUT)

if __name__ == "__main__":
    main()
