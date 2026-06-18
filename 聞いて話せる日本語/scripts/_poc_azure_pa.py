# POC: Azure発音評価で日本語TTSの読み誤りを検出できるか検証。
#  参照テキスト=jp-reading.json の「正しいかな」。音声=audio/ja/conv/<id>.mp3 → wav16k。
#  期待: 4-2-1(方=かた のまま=誤読)が低スコア/Mispronunciation、修正済みは高スコア。
import os, re, json, base64, subprocess, tempfile, urllib.request, sys
sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env = {}
for l in open(os.path.join(ROOT, ".env"), encoding="utf-8"):
    m = re.match(r"\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$", l)
    if m: env[m.group(1)] = m.group(2).strip().strip('"').strip("'")
KEY, REG = env["AZURE_SPEECH_KEY"], env["AZURE_SPEECH_REGION"]
EP = f"https://{REG}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=ja-JP&format=detailed"
ex = json.load(open(os.path.join(ROOT, "expo-app/data/examples.json"), encoding="utf-8"))
jr = json.load(open(os.path.join(ROOT, "expo-app/data/jp-reading.json"), encoding="utf-8"))
def refkana(i):
    a, b, c = i.split("-"); jp = ex[f"{a}-{b}"][int(c) - 1]["jp"]
    return jp, jr[jp]["kana"].replace("、", " ").replace("。", "").replace("？", "").strip()
def towav(i):
    mp3 = os.path.join(ROOT, "audio/ja/conv", i + ".mp3"); w = tempfile.mktemp(suffix=".wav")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", mp3, "-ar", "16000", "-ac", "1", w], check=True)
    return w
def assess(i):
    jp, ref = refkana(i)
    cfg = {"ReferenceText": ref, "GradingSystem": "HundredMark", "Granularity": "Phoneme", "Dimension": "Comprehensive", "EnableMiscue": True}
    hdr = {"Ocp-Apim-Subscription-Key": KEY, "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
           "Accept": "application/json", "Pronunciation-Assessment": base64.b64encode(json.dumps(cfg).encode()).decode()}
    data = open(towav(i), "rb").read()
    try:
        r = urllib.request.urlopen(urllib.request.Request(EP, data=data, headers=hdr, method="POST"), timeout=60)
        return jp, ref, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return jp, ref, {"_error": e.code, "_body": e.read().decode()[:300]}
import difflib
def norm(s): return re.sub(r"[、。？\s]", "", s or "")
TESTS = [("4-2-1", "未修正(方=かた)テストピース"), ("4-2-6", "修正済(方=ほう)"),
         ("6-2-1", "修正済(辛=から)"), ("25-1-19", "修正済(弾く=ひく)"), ("12-1-5", "修正済(空き=すき)")]
for i, note in TESTS:
    jp, ref, res = assess(i)
    if "_error" in res:
        print(f"\n===== {i} [{note}]  HTTP ERROR {res['_error']} {res['_body']}"); continue
    nb = (res.get("NBest") or [{}])[0]
    rec_raw = nb.get("Display") or nb.get("Lexical") or ""
    a, b, c = i.split("-"); jp_full = ex[f"{a}-{b}"][int(c) - 1]["jp"]
    refk = jr[jp_full]["kana"]
    R, G = norm(refk), norm(rec_raw)
    ok = (R == G)
    # 相違スパンの抽出
    diffs = []
    sm = difflib.SequenceMatcher(None, R, G)
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag != "equal":
            diffs.append(f"参照[{R[i1:i2]}]↔音声[{G[j1:j2]}]")
    print(f"\n===== {i} [{note}]")
    print(f"  原文      : {jp}")
    print(f"  参照かな  : {refk}")
    print(f"  音声認識  : {rec_raw}")
    print(f"  判定      : {'✅ 一致(問題なし)' if ok else '❌ 不一致 → 要確認  ' + ' / '.join(diffs)}")
