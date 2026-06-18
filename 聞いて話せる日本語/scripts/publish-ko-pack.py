#!/usr/bin/env python3
"""App B 韓国語パック 追加公開(ko のみ・既存言語は不変)。

  audio/ko/{conv,gram}/*.mp3 (マスター) → 32k STORED → dist-packs/audio-ko.zip
  expo-app/data/overlays/ko.json         → dist-packs/overlay-ko.json (minified)
  Release packs-appb-v2 の catalog.json に packs[l1=ko] を追加(core/既存packsはそのまま)
  gh release upload で overlay-ko.json / audio-ko.zip / catalog.json をアップ。

使い方:
  python scripts/publish-ko-pack.py            # ビルドのみ(dist-packs/ に出力・catalogプレビュー)
  python scripts/publish-ko-pack.py --publish  # + Release packs-appb-v2 へアップ
要件: ffmpeg / (publish) gh CLI + Release権限。
"""
import argparse, json, os, shutil, subprocess, sys, tempfile, urllib.request, zipfile
from concurrent.futures import ThreadPoolExecutor

REPO = "JinKato2020/safa-language-apps"
TAG = "packs-appb-v2"
APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # 聞いて話せる日本語/
AUDIO_KO = os.path.join(APP_DIR, "audio", "ko")
OVERLAY_KO = os.path.join(APP_DIR, "expo-app", "data", "overlays", "ko.json")
DIST = os.path.join(APP_DIR, "dist-packs")
FFMPEG = shutil.which("ffmpeg") or r"C:\ffmpeg\bin\ffmpeg.exe"
REL = f"https://github.com/{REPO}/releases/download/{TAG}"
CATALOG_URL = f"{REL}/catalog.json"
# 新規 ko の版(既存 v1003/aV100x と同オーダーに揃える)
KO_VERSION = 1003
KO_AUDIO_VERSION = 1001


def enc32k(args):
    arcname, src, tmp = args
    dst = os.path.join(tmp, arcname)
    r = subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", src,
                        "-ar", "24000", "-ac", "1", "-b:a", "32k", "-map_metadata", "-1", dst],
                       capture_output=True)
    if r.returncode != 0 or not os.path.exists(dst):
        raise RuntimeError(f"ffmpeg失敗 {arcname}: {r.stderr.decode('utf-8','replace')[:200]}")
    return (arcname, src) if os.path.getsize(src) <= os.path.getsize(dst) else (arcname, dst)


def build_audio_zip():
    files = []
    for sub in ("conv", "gram"):
        d = os.path.join(AUDIO_KO, sub)
        if os.path.isdir(d):
            files += [os.path.join(d, f) for f in os.listdir(d) if f.endswith(".mp3")]
    if not files:
        raise SystemExit(f"ERROR: 音源が無い: {AUDIO_KO}/(conv|gram)")
    tmp = tempfile.mkdtemp(prefix="appb_ko_")
    tasks = [(os.path.basename(f), f, tmp) for f in files]
    chosen = {}
    with ThreadPoolExecutor(max_workers=10) as ex:
        for arcname, path in ex.map(enc32k, tasks):
            chosen[arcname] = path
    os.makedirs(DIST, exist_ok=True)
    zpath = os.path.join(DIST, "audio-ko.zip")
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_STORED) as z:
        for arcname in sorted(chosen):
            z.write(chosen[arcname], arcname)
    shutil.rmtree(tmp, ignore_errors=True)
    print(f"  audio-ko.zip: {len(files)}files → {os.path.getsize(zpath)/1e6:.1f}MB", flush=True)
    return zpath


def build_overlay():
    ov = json.load(open(OVERLAY_KO, encoding="utf-8"))
    ov["version"] = KO_VERSION
    os.makedirs(DIST, exist_ok=True)
    p = os.path.join(DIST, "overlay-ko.json")
    json.dump(ov, open(p, "w", encoding="utf-8"), ensure_ascii=False)  # minified
    print(f"  overlay-ko.json: {os.path.getsize(p)/1e6:.2f}MB (convVocab {len(ov.get('convVocab',{}))}語)", flush=True)
    return p


def fetch_catalog():
    req = urllib.request.Request(CATALOG_URL + "?t=build", headers={"User-Agent": "appb-ko"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--publish", action="store_true"); args = ap.parse_args()
    print("== build ko pack ==")
    zpath = build_audio_zip()
    opath = build_overlay()
    zbytes, obytes = os.path.getsize(zpath), os.path.getsize(opath)

    cat = fetch_catalog()
    cat["packs"] = [p for p in cat.get("packs", []) if p.get("l1") != "ko"]  # 既存ko除去(再実行対応)
    cat["packs"].append({
        "l1": "ko", "version": KO_VERSION,
        "url": f"{REL}/overlay-ko.json", "sizeBytes": obytes,
        "audioVersion": KO_AUDIO_VERSION, "audioZip": f"{REL}/audio-ko.zip", "audioZipBytes": zbytes,
    })
    cat_path = os.path.join(DIST, "catalog.json")
    json.dump(cat, open(cat_path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print("  catalog packs:", [(p["l1"], p["version"], p.get("audioVersion")) for p in cat["packs"]])

    if not args.publish:
        print(f"\nビルド完了(未公開): {DIST}/ に audio-ko.zip / overlay-ko.json / catalog.json。公開は --publish。")
        return
    gh = shutil.which("gh") or r"C:\Users\jwpsa\AppData\Local\Programs\gh\bin\gh.exe"
    print("\n== publish (Release", TAG, ") ==")
    subprocess.run([gh, "release", "upload", TAG, zpath, opath, cat_path, "--repo", REPO, "--clobber"], check=True)
    print("  公開完了: ko を packs-appb-v2 に追加。")


if __name__ == "__main__":
    main()
