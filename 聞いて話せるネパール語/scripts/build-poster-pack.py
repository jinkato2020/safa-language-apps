#!/usr/bin/env python3
"""App A ポスター(音声+画像)を母語別DLパック化 → Release packs-poster-appa。
  ne = ターゲット音声(母語横断で共有・画像なし) / ja・en = 母語の音声 + ポスター画像。
  zip内パスは多階層保持: "<theme>[/pageN]/audio/<NN>_<L>.mp3"(title含む) / "<theme>[/pageN]/poster_<L>.png"。
  catalog.json: { version, langs: { L: {url, bytes, version} } }。STORED(無圧縮)=ローダのストリーミング展開前提。
使い方:
  python scripts/build-poster-pack.py            # dist-poster/ にビルドのみ
  python scripts/build-poster-pack.py --publish  # + Release packs-poster-appa へ upload
"""
import argparse, json, os, zipfile

REPO = "JinKato2020/safa-language-apps"
TAG = "packs-poster-appa"
APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # 聞いて話せるネパール語/
POSTER = os.path.join(APP_DIR, "expo-app", "assets", "poster")
DIST = os.path.join(APP_DIR, "dist-poster")
REL = f"https://github.com/{REPO}/releases/download/{TAG}"
LANGS = ["ne", "ja"]   # ne=ターゲット(画像なし) / ja=母語(音声+画像)。en は生成後に追加。
VERSION = 2   # 2026-06-19: 新レイアウト(グレー枠)+テーマ1-10で全面再生成。版上げで端末側の再DLを強制。


def build_lang(L):
    # POSTER 配下を再帰探索(numbers の page1..5/audio 等の多階層に対応)。
    entries = []  # (abs_path, arcname=POSTER相対)
    for root, _dirs, files in os.walk(POSTER):
        for f in files:
            if f.endswith(f"_{L}.mp3") or f == f"poster_{L}.png":
                rel = os.path.relpath(os.path.join(root, f), POSTER).replace("\\", "/")
                entries.append((os.path.join(root, f), rel))
    if not entries:
        return None
    os.makedirs(DIST, exist_ok=True)
    z = os.path.join(DIST, f"poster-{L}.zip")
    with zipfile.ZipFile(z, "w", zipfile.ZIP_STORED) as zf:
        for src, arc in sorted(entries, key=lambda e: e[1]):
            zf.write(src, arc)
    print(f"  poster-{L}.zip: {len(entries)}files {os.path.getsize(z)/1e6:.1f}MB", flush=True)
    return z


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--publish", action="store_true"); args = ap.parse_args()
    print("== build App A poster packs (packs-poster-appa) ==")
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
    r = subprocess.run([gh, "release", "view", TAG, "--repo", REPO], capture_output=True)
    if r.returncode != 0:
        subprocess.run([gh, "release", "create", TAG, "--repo", REPO, "--title", "App A poster packs", "--notes", "App A (ne) poster audio+image packs"], check=True)
    subprocess.run([gh, "release", "upload", TAG, *zips, cat_path, "--repo", REPO, "--clobber"], check=True)
    print("\n公開完了: Release", TAG)


if __name__ == "__main__":
    main()
