#!/usr/bin/env python3
"""App A 音声パック再生成: マスター audio/<lang>/{conv,gram} → 32k化 → STORED zip → (任意)Release公開。

マスター(audio/ne|en|ja/{conv,gram}/*.mp3, Git追跡)を唯一の正とし、ここから
配信パックを毎回同じ手順で焼き直す。32k化はファイル毎min(既に≤32kなら元を保持
=劣化ゼロ・増やさない)。zipはSTORED(packLoaderのストリーミング展開前提)。

  ne → audio-core.zip   (catalog.core)
  en → audio-en.zip     (catalog.packs[l1=en])
  ja → audio-ja.zip     (catalog.packs[l1=ja])

使い方:
  python scripts/build_appa_packs_32k.py            # ビルドのみ(dist-packs/ に出力・サイズ表示)
  python scripts/build_appa_packs_32k.py --publish  # 上記 + catalog更新(audioVersion+1) + gh release upload

要件: ffmpeg / (publish時) gh CLI + Release packs-appa-v2 への権限。CIではffmpeg/ghが既定で使える。
"""
import argparse
import json
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import zipfile
from concurrent.futures import ThreadPoolExecutor

REPO = "JinKato2020/safa-language-apps"
TAG = "packs-appa-v2"
APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # 聞いて話せるネパール語/
AUDIO = os.path.join(APP_DIR, "audio")
DIST = os.path.join(APP_DIR, "dist-packs")
FFMPEG = shutil.which("ffmpeg") or "ffmpeg"
# lang → (zip名, catalog内の置き場所キー)
LANGS = {"ne": "audio-core.zip", "en": "audio-en.zip", "ja": "audio-ja.zip"}
CATALOG_URL = f"https://github.com/{REPO}/releases/download/{TAG}/catalog.json"


def enc32k(args):
    """1ファイルを32k化。元が既に小さければ元を採用(per-file min)。(arcname, 採用パス) を返す。"""
    arcname, src, tmp = args
    dst = os.path.join(tmp, arcname)
    r = subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", src,
                        "-ar", "24000", "-ac", "1", "-b:a", "32k", "-map_metadata", "-1", dst],
                       capture_output=True)
    if r.returncode != 0 or not os.path.exists(dst):
        raise RuntimeError(f"ffmpeg失敗 {arcname}: {r.stderr.decode('utf-8','replace')[:200]}")
    # 元の方が小さい(=既に≤32k)なら元を使う=劣化させない
    return (arcname, src) if os.path.getsize(src) <= os.path.getsize(dst) else (arcname, dst)


def build_lang(lang):
    """audio/<lang>/{conv,gram}/*.mp3 を32k化しSTORED zipを作る。zipパスを返す。"""
    files = []
    for sub in ("conv", "gram"):
        d = os.path.join(AUDIO, lang, sub)
        if os.path.isdir(d):
            files += [os.path.join(d, f) for f in os.listdir(d) if f.endswith(".mp3")]
    if not files:
        raise RuntimeError(f"音源が見つからない: audio/{lang}/(conv|gram)")
    tmp = tempfile.mkdtemp(prefix=f"appa_{lang}_")
    tasks = [(os.path.basename(f), f, tmp) for f in files]  # arcname=ファイル名(平坦)
    chosen = {}
    with ThreadPoolExecutor(max_workers=10) as ex:
        for arcname, path in ex.map(enc32k, tasks):
            chosen[arcname] = path
    os.makedirs(DIST, exist_ok=True)
    zpath = os.path.join(DIST, LANGS[lang])
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_STORED) as z:
        for arcname in sorted(chosen):
            z.write(chosen[arcname], arcname)
    shutil.rmtree(tmp, ignore_errors=True)
    insz = sum(os.path.getsize(f) for f in files)
    outsz = os.path.getsize(zpath)
    print(f"  {lang} → {LANGS[lang]}: {len(files)}files {insz/1e6:.1f}MB(master) → {outsz/1e6:.1f}MB(32k zip)", flush=True)
    return zpath


def fetch_catalog():
    req = urllib.request.Request(CATALOG_URL + "?t=build", headers={"User-Agent": "appa-pack-builder"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def update_catalog(cat, sizes):
    """audioZipBytes 更新 + audioVersion +1(ne=core, en/ja=packs)。"""
    cat["core"]["audioZipBytes"] = sizes["ne"]
    cat["core"]["audioVersion"] = int(cat["core"].get("audioVersion", 0)) + 1
    for p in cat.get("packs", []):
        if p.get("l1") in ("en", "ja"):
            p["audioZipBytes"] = sizes[p["l1"]]
            p["audioVersion"] = int(p.get("audioVersion", 0)) + 1
    return cat


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--publish", action="store_true", help="catalog更新+gh release uploadまで実行")
    args = ap.parse_args()

    print("== build (master → 32k STORED zip) ==")
    sizes = {}
    for lang in LANGS:
        z = build_lang(lang)
        sizes[lang] = os.path.getsize(z)

    if not args.publish:
        print(f"\nビルド完了: {DIST}/ (audio-core/en/ja.zip)。公開は --publish。")
        return

    gh = shutil.which("gh")
    if not gh:
        sys.exit("ERROR: gh CLI が見つかりません(publishに必要)")
    print("\n== publish ==")
    cat = fetch_catalog()
    cat = update_catalog(cat, sizes)
    cat_path = os.path.join(DIST, "catalog.json")
    with open(cat_path, "w", encoding="utf-8") as f:
        json.dump(cat, f, ensure_ascii=False, indent=2)
    print("  catalog: core aV=%d / en,ja aV=%s" % (
        cat["core"]["audioVersion"], [p["audioVersion"] for p in cat["packs"] if p["l1"] in ("en", "ja")]))
    assets = [os.path.join(DIST, n) for n in ("audio-core.zip", "audio-en.zip", "audio-ja.zip")] + [cat_path]
    subprocess.run([gh, "release", "upload", TAG, *assets, "--repo", REPO, "--clobber"], check=True)
    print("  公開完了 (Release", TAG, ")")


if __name__ == "__main__":
    main()
