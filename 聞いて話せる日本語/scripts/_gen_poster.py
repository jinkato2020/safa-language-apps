# ポスター音声学習データ生成(自己完結): 02日本語教材/{2_ポスター,3_音声/_正規化} のみを入力に、
#  - 広告なしポスター(bn/en/ne/vi)と正規化音声(ja+4言語)を expo-app/assets/poster/<id>/ へコピー
#  - 音声は 32k/24kHz mono へ再エンコード(既存はスキップ)。ポスターPNGはそのままコピー
#  - title_<lang>.mp3 もコピー(タイトル朗読用)
#  - box座標はグリッド自動算出。左へ48px拡張し番号バッジ(実測 x≥74)まで含める
#  - posterLessons.ts を生成(imageL1 / card.l1 / ja / titleAudio)
import os, re, math, shutil, subprocess
SRC = r"C:\Users\jwpsa\Documents\desktop\claude\02日本語教材"
POSTER_SRC = os.path.join(SRC, "2_ポスター")
AUDIO_SRC = os.path.join(SRC, "3_音声", "_正規化")
APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(APP, "expo-app", "assets", "poster")
TS_OUT = os.path.join(APP, "expo-app", "src", "posterLessons.ts")
FFMPEG = shutil.which("ffmpeg") or r"C:\ffmpeg\bin\ffmpeg.exe"
LANGS = ["bn", "en", "ne", "vi"]
ALL = ["ja"] + LANGS
LANGDIR = {"ja": "JA", "bn": "BN", "en": "EN", "ne": "NE", "vi": "VI"}
POSTER_W, POSTER_H = 2480, 3508
LEFTEXT = 48   # 番号バッジ(実測 x≥74)を含めるための左拡張
THEMES = [("family", "01_家族"), ("numbers", "02_数字"), ("body", "03_体"),
          ("colors", "04_色と形"), ("food", "05_食べ物")]

def enc32k(src, dst):
    if os.path.exists(dst):
        return
    r = subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", src,
                        "-ar", "24000", "-ac", "1", "-b:a", "32k", "-map_metadata", "-1", dst],
                       capture_output=True)
    if r.returncode != 0 or not os.path.exists(dst):
        raise RuntimeError("ffmpeg fail " + src + " " + r.stderr.decode("utf-8", "replace")[:200])

def cell_count(folder):
    d = os.path.join(AUDIO_SRC, "JA", folder)
    return len([f for f in os.listdir(d) if re.match(r"^\d+_ja\.mp3$", f)])

def boxes(n):
    R = math.ceil(n / 2)
    step = 2940 / R                      # R=10→294 (family実測と一致)
    h = round(step - 18)
    out = []
    for i in range(n):
        col, row = (0, i) if i < R else (1, i - R)
        x = (100 if col == 0 else 1266) - LEFTEXT
        out.append({"i": i, "x": x, "y": round(464 + row * step), "w": 1114 + LEFTEXT, "h": h})
    return out

def jp_title(folder):
    return re.sub(r"^\d+_", "", folder)

def main():
    lessons = []
    for lid, folder in THEMES:
        n = cell_count(folder)
        dst_dir = os.path.join(ASSETS, lid)
        aud_dir = os.path.join(dst_dir, "audio")
        os.makedirs(aud_dir, exist_ok=True)
        for L in LANGS:   # ポスター(母語別)
            src_png = os.path.join(POSTER_SRC, L, f"{folder}_広告なし_{L}.png")
            if not os.path.exists(src_png):
                raise RuntimeError("poster missing: " + src_png)
            shutil.copyfile(src_png, os.path.join(dst_dir, f"poster_{L}.png"))
        for L in ALL:     # 音声(語 + タイトル)。既存はスキップ
            for k in range(1, n + 1):
                enc32k(os.path.join(AUDIO_SRC, LANGDIR[L], folder, f"{k:02d}_{L}.mp3"),
                       os.path.join(aud_dir, f"{k:02d}_{L}.mp3"))
            ts = os.path.join(AUDIO_SRC, LANGDIR[L], folder, f"title_{L}.mp3")
            if os.path.exists(ts):
                enc32k(ts, os.path.join(aud_dir, f"title_{L}.mp3"))
        lessons.append({"id": lid, "title": jp_title(folder), "n": n, "boxes": boxes(n)})
        print(f"  {lid} ({folder}): {n}cells +title, posters{len(LANGS)}", flush=True)

    rel = "../assets/poster"
    L = ["// 自動生成 (scripts/_gen_poster.py)。素材: 02日本語教材/{2_ポスター,3_音声/_正規化}",
         "// box=グリッド自動算出(左48px拡張で番号バッジまで内包)。imageL1/card.l1/ja/titleAudio。",
         "export type PosterCard = { i: number; box: { x: number; y: number; w: number; h: number }; ja: number; l1: Record<string, number> };",
         "export type PosterLesson = { id: string; title: string; titleNp?: string; imageL1: Record<string, number>; titleAudio?: { ja: number; l1: Record<string, number> }; posterW: number; posterH: number; cards: PosterCard[] };",
         "", "export const POSTER_LESSONS: PosterLesson[] = ["]
    for ls in lessons:
        lid = ls["id"]
        img = ", ".join([f"{l}:require('{rel}/{lid}/poster_{l}.png')" for l in LANGS])
        tl1 = ", ".join([f"{l}:require('{rel}/{lid}/audio/title_{l}.mp3')" for l in LANGS])
        L.append(f" {{ id:'{lid}', title:'{ls['title']}', posterW:{POSTER_W}, posterH:{POSTER_H},")
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
