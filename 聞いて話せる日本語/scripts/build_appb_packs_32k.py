#!/usr/bin/env python3
"""App B 音声パック再生成: マスター audio/<lang>/{conv,gram} → 32k化 → STORED zip → (任意)Release公開。

App A/C の build_app{a,c}_packs_32k.py と同方式。App B は ターゲット=ja / 母語=bn,en,vi,ne,zh、
配信タグ=packs-appb-v2、catalog は core{} + packs[{l1,...}] 形式(App Aと同形)。

  ja → audio-core.zip   (catalog.core)
  bn → audio-bn.zip / en → audio-en.zip / ne → audio-ne.zip / vi → audio-vi.zip / zh → audio-zh.zip
                        (catalog.packs[l1=<lang>])

使い方:
  python scripts/build_appb_packs_32k.py            # ビルドのみ(dist-packs/ に出力)
  python scripts/build_appb_packs_32k.py --publish  # + catalog更新(audioVersion+1) + gh release upload

要件: ffmpeg / (publish時) gh CLI + Release packs-appb-v2 への権限。
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
TAG = "packs-appb-v2"
APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # 聞いて話せる日本語/
AUDIO = os.path.join(APP_DIR, "audio")
DIST = os.path.join(APP_DIR, "dist-packs")
FFMPEG = shutil.which("ffmpeg") or "ffmpeg"
# lang → zip名。ja=ターゲット(core)、他=母語L1。
LANGS = {"ja": "audio-core.zip", "bn": "audio-bn.zip", "en": "audio-en.zip",
         "ne": "audio-ne.zip", "vi": "audio-vi.zip", "zh": "audio-zh.zip"}
CATALOG_URL = f"https://github.com/{REPO}/releases/download/{TAG}/catalog.json"


def enc32k(args):
    arcname, src, tmp = args
    dst = os.path.join(tmp, arcname)
    r = subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", src,
                        "-ar", "24000", "-ac", "1", "-b:a", "32k", "-map_metadata", "-1", dst],
                       capture_output=True)
    if r.returncode != 0 or not os.path.exists(dst):
        raise RuntimeError(f"ffmpeg失敗 {arcname}: {r.stderr.decode('utf-8','replace')[:200]}")
    return (arcname, src) if os.path.getsize(src) <= os.path.getsize(dst) else (arcname, dst)


def build_lang(lang):
    files = []
    for sub in ("conv", "gram"):
        d = os.path.join(AUDIO, lang, sub)
        if os.path.isdir(d):
            files += [os.path.join(d, f) for f in os.listdir(d) if f.endswith(".mp3")]
    if not files:
        raise RuntimeError(f"音源が見つからない: audio/{lang}/(conv|gram)")
    tmp = tempfile.mkdtemp(prefix=f"appb_{lang}_")
    tasks = [(os.path.basename(f), f, tmp) for f in files]
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
    req = urllib.request.Request(CATALOG_URL + "?t=build", headers={"User-Agent": "appb-pack-builder"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def update_catalog(cat, sizes):
    """ja=core / bn,en,ne,vi,zh=packs[l1] の audioZipBytes 更新 + audioVersion +1。"""
    cat["core"]["audioZipBytes"] = sizes["ja"]
    cat["core"]["audioVersion"] = int(cat["core"].get("audioVersion", 0)) + 1
    for p in cat.get("packs", []):
        l1 = p.get("l1")
        if l1 in sizes:
            p["audioZipBytes"] = sizes[l1]
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
        print(f"\nビルド完了: {DIST}/ (audio-core/bn/en/ne/vi/zh.zip)。公開は --publish。")
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
    print("  catalog core aV=%d / packs=%s" % (
        cat["core"]["audioVersion"], [(p["l1"], p["audioVersion"]) for p in cat["packs"]]))
    assets = [os.path.join(DIST, n) for n in LANGS.values()] + [cat_path]
    subprocess.run([gh, "release", "upload", TAG, *assets, "--repo", REPO, "--clobber"], check=True)
    print("  公開完了 (Release", TAG, ")")


if __name__ == "__main__":
    main()
