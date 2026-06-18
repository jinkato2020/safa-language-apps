# App A 日本語(L1)音声 全2400件 読み検査(Azure発音評価のかな認識 × jp-reading 正解かな 差分)。
#  App B と同手法。Azureキーは App A .env に無いので App B .env からフォールバック取得。
#  会話 audio/ja/conv (examples.json.jp) + 文法 audio/ja/gram (grammarExamples.json.jp)。
#  再開可能(_pa_scan_results_appa.json)。出力: AppA_読み要確認.xlsx。
import os, re, json, base64, subprocess, tempfile, urllib.request, urllib.error, sys, time, difflib
from concurrent.futures import ThreadPoolExecutor
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))      # 聞いて話せるネパール語
REPO_ROOT = os.path.dirname(ROOT)
env = {}
for path in (os.path.join(ROOT, ".env"), os.path.join(REPO_ROOT, "聞いて話せる日本語", ".env")):
    try:
        for l in open(path, encoding="utf-8"):
            m = re.match(r"\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$", l)
            if m and m.group(1) not in env: env[m.group(1)] = m.group(2).strip().strip('"').strip("'")
    except FileNotFoundError: pass
KEY, REG = env["AZURE_SPEECH_KEY"], env["AZURE_SPEECH_REGION"]
EP = f"https://{REG}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=ja-JP&format=detailed"
ex = json.load(open(os.path.join(ROOT, "expo-app/data/examples.json"), encoding="utf-8"))
gr = json.load(open(os.path.join(ROOT, "expo-app/data/grammarExamples.json"), encoding="utf-8"))
jr = json.load(open(os.path.join(ROOT, "expo-app/data/jp-reading.json"), encoding="utf-8"))
RES = os.path.join(ROOT, "scripts/_pa_scan_results_appa.json")
XLSX = os.path.join(ROOT, "AppA_読み要確認.xlsx")
norm = lambda s: re.sub(r"[、。？！\s]", "", s or "")

items = []
for k, arr in ex.items():
    for i, e in enumerate(arr): items.append((f"{k}-{i+1}", "conv", e.get("jp")))
for k, arr in gr.items():
    for i, e in enumerate(arr): items.append((f"{k}-{i+1}", "gram", e.get("jp") if isinstance(e, dict) else e))

results = {}
if os.path.exists(RES):
    try: results = json.load(open(RES, encoding="utf-8"))
    except Exception: results = {}
todo = [it for it in items if it[0] not in results]
print(f"App A 全{len(items)} / 残{len(todo)} を検査", flush=True)

def assess(idv, mode, jp):
    wav = None
    try:
        ref = jr.get(jp, {}).get("kana", "")
        mp3 = os.path.join(ROOT, "audio", "ja", mode, idv + ".mp3")
        if not os.path.exists(mp3): return idv, {"mode": mode, "jp": jp, "ref": ref, "rec": "", "ok": None, "diff": "NOAUDIO"}
        if not ref: return idv, {"mode": mode, "jp": jp, "ref": "", "rec": "", "ok": None, "diff": "NOREADING"}
        wav = tempfile.mktemp(suffix=".wav")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", mp3, "-ar", "16000", "-ac", "1", wav], check=True, capture_output=True)
        cfg = {"ReferenceText": ref.replace("、", " ").replace("。", "").replace("？", "").strip(), "GradingSystem": "HundredMark", "Granularity": "Word", "EnableMiscue": True}
        hdr = {"Ocp-Apim-Subscription-Key": KEY, "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000", "Accept": "application/json", "Pronunciation-Assessment": base64.b64encode(json.dumps(cfg).encode()).decode()}
        data = open(wav, "rb").read(); rec = ""
        for a in range(5):
            try:
                r = urllib.request.urlopen(urllib.request.Request(EP, data=data, headers=hdr, method="POST"), timeout=60)
                nb = (json.loads(r.read().decode()).get("NBest") or [{}])[0]; rec = nb.get("Display") or nb.get("Lexical") or ""; break
            except urllib.error.HTTPError as e:
                if e.code in (429, 500, 502, 503) and a < 4: time.sleep(2 * (a + 1)); continue
                raise
            except Exception:
                if a < 4: time.sleep(2 * (a + 1)); continue
                raise
        R, G = norm(ref), norm(rec); ok = (R == G)
        diffs = []
        if not ok:
            for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, R, G).get_opcodes():
                if tag != "equal": diffs.append(f"参照[{R[i1:i2]}]↔音声[{G[j1:j2]}]")
        return idv, {"mode": mode, "jp": jp, "ref": ref, "rec": rec, "ok": ok, "diff": " / ".join(diffs)}
    except Exception as e:
        return idv, {"mode": mode, "jp": jp, "ref": jr.get(jp, {}).get("kana", ""), "rec": "", "ok": None, "diff": f"ERROR:{e}"}
    finally:
        if wav and os.path.exists(wav):
            try: os.remove(wav)
            except OSError: pass

done = 0
with ThreadPoolExecutor(max_workers=8) as exr:
    for idv, rec in exr.map(lambda it: assess(*it), todo):
        results[idv] = rec; done += 1
        if done % 50 == 0:
            json.dump(results, open(RES, "w", encoding="utf-8"), ensure_ascii=False)
            ng = sum(1 for v in results.values() if v["ok"] is False)
            print(f"  {done}/{len(todo)} (現NG {ng})", flush=True)
json.dump(results, open(RES, "w", encoding="utf-8"), ensure_ascii=False)

import openpyxl
from openpyxl.styles import Font
wb = openpyxl.Workbook(); ws = wb.active; ws.title = "読み要確認"
ws.append(["番号", "モード", "原文", "参照かな(正解)", "音声認識", "相違スパン"])
for c in ws[1]: c.font = Font(bold=True)
def sk(idv):
    p = idv.split("-"); return tuple(int(x) if x.isdigit() else 0 for x in p)
ng = [k for k in results if results[k]["ok"] is False]; err = [k for k in results if results[k]["ok"] is None]
for idv in sorted(ng + err, key=sk):
    v = results[idv]; ws.append([idv, v["mode"], v["jp"], v["ref"], v["rec"], v["diff"]])
for col, w in zip("ABCDEF", (10, 7, 40, 34, 34, 40)): ws.column_dimensions[col].width = w
wb.save(XLSX)
okc = sum(1 for v in results.values() if v["ok"] is True)
print(f"\nDONE 全{len(results)} 一致{okc} 要確認{len(ng)} エラー{len(err)} → {os.path.basename(XLSX)}")
