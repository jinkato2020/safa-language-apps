#!/usr/bin/env python3
"""差分DL用: パック音声の manifest(ファイル毎sha1) と差分zip(前版から変わった分だけ)を生成。

差分DLの仕組み(packLoaderと対):
  - 初回インストール: フルzip(audio-<lang>.zip)をDL→展開。
  - 更新: ローカル版 == catalog.deltaBaseVersion かつ deltaZip があれば、
          「前版から変わったファイルだけ」の差分zip(数百KB)をDL→既存の上に上書き展開。
          版が飛ぶ/差分無しならフルzip(後方互換)。

このツールは「新版フルzip」と「前版(現公開)フルzip」を比較し、
  - manifest-<lang>.json : { audioVersion, files: { "<id>.mp3": "<sha1>" } }
  - delta-<lang>.zip      : 新版にあって sha が前版と違う/新規のファイルだけ(STORED)
を出力。前版zip未指定なら manifest のみ(差分DLの土台版を確立)。

usage:
  # 土台(baseline) manifest だけ作る(初回公開時):
  python scripts/pack_build_delta.py --new audio-ja.zip --out ./out --lang ja --audio-version 1000
  # 差分も作る(更新公開時。--prev に現公開フルzip):
  python scripts/pack_build_delta.py --new audio-ja-new.zip --prev audio-ja-cur.zip --out ./out --lang ja --audio-version 1001 --base-version 1000

出力後の公開手順:
  1) フル audio-<lang>.zip, delta-<lang>.zip, manifest-<lang>.json を Release 資産にアップ。
  2) catalog の該当 l1 に: audioVersion, audioZip(フル), audioZipBytes,
     deltaZip, deltaZipBytes, deltaBaseVersion, manifestUrl を設定。
     (deltaBaseVersion = 直前に公開していた audioVersion)
"""
import argparse, hashlib, json, os, zipfile


def entries(zip_path):
    """zip内の各エントリ name -> bytes (ディレクトリ除く)。"""
    out = {}
    with zipfile.ZipFile(zip_path) as z:
        for info in z.infolist():
            if info.is_dir():
                continue
            out[info.filename] = z.read(info.filename)
    return out


def sha1(b):
    return hashlib.sha1(b).hexdigest()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--new", required=True, help="新版フルzip")
    ap.add_argument("--prev", help="前版(現公開)フルzip。指定で差分zipを生成")
    ap.add_argument("--out", required=True, help="出力ディレクトリ")
    ap.add_argument("--lang", required=True)
    ap.add_argument("--audio-version", required=True, type=int)
    ap.add_argument("--base-version", type=int, help="差分の土台版(=直前公開のaudioVersion)")
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    new = entries(args.new)
    new_sha = {n: sha1(b) for n, b in new.items()}

    manifest = {"audioVersion": args.audio_version, "files": new_sha}
    mpath = os.path.join(args.out, f"manifest-{args.lang}.json")
    with open(mpath, "w", encoding="utf-8") as f:
        json.dump(manifest, f, separators=(",", ":"), ensure_ascii=False)
    print(f"manifest: {mpath} ({len(new_sha)} files)")

    if not args.prev:
        print("(--prev 未指定: manifest のみ＝土台版確立)")
        return

    prev = entries(args.prev)
    prev_sha = {n: sha1(b) for n, b in prev.items()}
    changed = [n for n, h in new_sha.items() if prev_sha.get(n) != h]
    removed = [n for n in prev_sha if n not in new_sha]

    dpath = os.path.join(args.out, f"delta-{args.lang}.zip")
    with zipfile.ZipFile(dpath, "w") as z:
        for n in changed:
            zi = zipfile.ZipInfo(n)
            zi.compress_type = zipfile.ZIP_STORED
            z.writestr(zi, new[n])
    dsize = os.path.getsize(dpath)
    full = os.path.getsize(args.new)
    print(f"delta: {dpath}  変更{len(changed)}件 / 新規含む / 削除{len(removed)}件(注:上書き方式のため旧ファイルは端末に残る=無害)")
    print(f"  サイズ: 差分 {dsize:,}B  (フル {full:,}B = {dsize*100//max(full,1)}%)")
    print("catalog 設定例:")
    print(json.dumps({
        "audioVersion": args.audio_version,
        "audioZipBytes": full,
        "deltaBaseVersion": args.base_version,
        "deltaZipBytes": dsize,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
