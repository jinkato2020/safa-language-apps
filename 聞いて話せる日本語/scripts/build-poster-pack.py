#!/usr/bin/env python3
"""ポスター(音声+画像)を言語別 DLパック化。同梱(assets/poster)→ Release packs-poster へ。

  各言語 L: poster-<L>.zip = その言語の音声(<theme>/audio/*_L.mp3, title含む) + 画像(<theme>/poster_L.png)
            zip内パスは "<theme>/audio/<file>" / "<theme>/poster_<L>.png"(構造保持=ローダがthemeで対応付け)
  catalog.json: { version, langs: { L: {zip(URL), bytes, version} } }
  ※ STORED(無圧縮)zip = ローダのストリーミング展開前提。音声は既に32k、画像pngは圧縮済。

使い方:
  python scripts/build-poster-pack.py            # dist-poster/ にビルドのみ
  python scripts/build-poster-pack.py --publish  # + Release packs-poster へ upload
要件: (publish) gh CLI + Release権限。
"""
import argparse, json, os, zipfile

REPO = "JinKato2020/safa-language-apps"
TAG = "packs-poster"
APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # 聞いて話せる日本語/
POSTER = os.path.join(APP_DIR, "expo-app", "assets", "poster")
DIST = os.path.join(APP_DIR, "dist-poster")
REL = f"https://github.com/{REPO}/releases/download/{TAG}"
LANGS = ["ja", "bn", "en", "ne", "vi", "zh"]
VERSION = 1


def build_lang(L):
    themes = sorted(d for d in os.listdir(POSTER) if os.path.isdir(os.path.join(POSTER, d)))
    entries = []  # (abs_path, arcname)
    for t in themes:
        ad = os.path.join(POSTER, t, "audio")
        if os.path.isdir(ad):
            for f in sorted(os.listdir(ad)):
                if f.endswith(f"_{L}.mp3"):
                    entries.append((os.path.join(ad, f), f"{t}/audio/{f}"))
        img = os.path.join(POSTER, t, f"poster_{L}.png")
        if os.path.exists(img):  # ja は画像なし(母語のみ)
            entries.append((img, f"{t}/poster_{L}.png"))
    if not entries:
        return None
    os.makedirs(DIST, exist_ok=True)
    z = os.path.join(DIST, f"poster-{L}.zip")
    with zipfile.ZipFile(z, "w", zipfile.ZIP_STORED) as zf:
        for src, arc in entries:
            zf.write(src, arc)
    print(f"  poster-{L}.zip: {len(entries)}files {os.path.getsize(z)/1e6:.1f}MB", flush=True)
    return z


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--publish", action="store_true"); args = ap.parse_args()
    print("== build poster packs ==")
    cat = {"version": VERSION, "langs": {}}
    zips = []
    for L in LANGS:
        z = build_lang(L)
        if not z:
            print(f"  {L}: skip(資産なし)"); continue
        zips.append(z)
        cat["langs"][L] = {"url": f"{REL}/poster-{L}.zip", "bytes": os.path.getsize(z), "version": VERSION}
    cat_path = os.path.join(DIST, "poster-catalog.json")
    json.dump(cat, open(cat_path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print("  catalog langs:", {L: f"{v['bytes']/1e6:.1f}MB" for L, v in cat["langs"].items()})
    if not args.publish:
        print(f"\nビルド完了(未公開): {DIST}/。公開は --publish。"); return
    import shutil, subprocess
    gh = shutil.which("gh") or r"C:\Users\jwpsa\AppData\Local\Programs\gh\bin\gh.exe"
    # Release が無ければ作成
    r = subprocess.run([gh, "release", "view", TAG, "--repo", REPO], capture_output=True)
    if r.returncode != 0:
        subprocess.run([gh, "release", "create", TAG, "--repo", REPO, "--title", "Poster packs", "--notes", "poster audio+image packs"], check=True)
    subprocess.run([gh, "release", "upload", TAG, *zips, cat_path, "--repo", REPO, "--clobber"], check=True)
    print("\n公開完了: Release", TAG)


if __name__ == "__main__":
    main()
