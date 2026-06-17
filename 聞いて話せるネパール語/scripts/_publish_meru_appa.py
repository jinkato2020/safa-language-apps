# App A: 15-1-14「メールで送ります。」差分公開 (packs-appa-v2)
#  TEXT: core.json(examplesNe+jpReading) / overlay-ja,en(examplesL1+convVocab) を版1003へ
#  AUDIO: ne(core)/ja/en の 15-1-14 を差し替え、full zip更新 + delta(1ファイル) deltaBase=1002, audioVersion 1002->1003
import os, json, shutil, subprocess, tempfile, urllib.request, zipfile, copy
APP=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST=os.path.join(APP,"dist-packs"); os.makedirs(DIST,exist_ok=True)
REPO="JinKato2020/safa-language-apps"; TAG="packs-appa-v2"
BASE=f"https://github.com/{REPO}/releases/download/{TAG}"
FFMPEG=shutil.which("ffmpeg") or "ffmpeg"; GH=shutil.which("gh") or "gh"
ID="15-1-14"; KEY="15-1"; I=13; TEXTV=1003; AUDIOV=1003; ABASE=1002
NEW_NE="इमेलबाट पठाउँछु।"; NEW_JA="メールで送ります。"; NEW_EN="I'll send it by email."
OLD_RD="ラインで送ります。"
RD={"kana":"メールで おくります。","romaji":"Meeru de okurimasu."}

def dl(name):
    p=os.path.join(DIST,name)
    urllib.request.urlretrieve(BASE+f"/{name}?t=pub", p); return p
def rj(p): return json.load(open(p,encoding="utf-8"))
def wj(p,d): json.dump(d,open(p,"w",encoding="utf-8"),ensure_ascii=False);
def enc32k(src,dst):
    r=subprocess.run([FFMPEG,"-y","-loglevel","error","-i",src,"-ar","24000","-ac","1","-b:a","32k","-map_metadata","-1",dst],capture_output=True)
    if r.returncode!=0 or not os.path.exists(dst): raise RuntimeError("ffmpeg "+src+" "+r.stderr.decode()[:200])
    return dst if os.path.getsize(dst)<os.path.getsize(src) else src
def mig(cv):  # convVocab re-tokenize (same as local edit)
    for k in ["लाइन","मा"]:
        if k in cv: cv[k]["contexts"]=[c for c in cv[k]["contexts"] if c.get("sentence_id")!=ID]
    for k in ["इमेल","बाट"]:
        if k in cv and not any(c.get("sentence_id")==ID for c in cv[k]["contexts"]):
            t=copy.deepcopy(cv[k]["contexts"][0]); t["sentence_id"]=ID; t.pop("note",None); cv[k]["contexts"].append(t)

print("== download published artifacts ==")
core=rj(dl("core.json")); ovja=rj(dl("overlay-ja.json")); oven=rj(dl("overlay-en.json")); cat=rj(dl("catalog.json"))
for z in ("audio-core.zip","audio-en.zip","audio-ja.zip"): dl(z)

print("== patch text ==")
core["examplesNe"][KEY][I]=NEW_NE
jr=core["jpReading"]; jr.pop(OLD_RD,None); jr[NEW_JA]=RD
ovja["examplesL1"][KEY][I]=NEW_JA; mig(ovja["convVocab"]); ovja["version"]=TEXTV
oven["examplesL1"][KEY][I]=NEW_EN; mig(oven["convVocab"]); oven["version"]=TEXTV
wj(os.path.join(DIST,"core.json"),core); wj(os.path.join(DIST,"overlay-ja.json"),ovja); wj(os.path.join(DIST,"overlay-en.json"),oven)

print("== audio: enc32k + swap into full zip + delta ==")
tmp=tempfile.mkdtemp(prefix="meruA_")
LMAP={"core":"ne","en":"en","ja":"ja"}; ZIP={"core":"audio-core.zip","en":"audio-en.zip","ja":"audio-ja.zip"}
deltas={}; fullbytes={}
for key,lang in LMAP.items():
    src=os.path.join(APP,"audio",lang,"conv",ID+".mp3")
    enc=enc32k(src, os.path.join(tmp,f"{key}.mp3"))
    # full zip: copy current, replace ID
    full=os.path.join(DIST,ZIP[key]); tmpfull=full+".new"
    with zipfile.ZipFile(full) as zin, zipfile.ZipFile(tmpfull,"w",zipfile.ZIP_STORED) as zout:
        for it in zin.infolist():
            if it.filename==ID+".mp3": continue
            zout.writestr(it, zin.read(it.filename))
        zout.write(enc, ID+".mp3")
    os.replace(tmpfull, full); fullbytes[key]=os.path.getsize(full)
    # delta zip
    dz=os.path.join(DIST,f"delta-{key}.zip")
    with zipfile.ZipFile(dz,"w",zipfile.ZIP_STORED) as z: z.write(enc, ID+".mp3")
    deltas[key]=os.path.getsize(dz)
    print(f"  {key}({lang}): full={fullbytes[key]/1e6:.1f}MB delta={deltas[key]}B")
shutil.rmtree(tmp,ignore_errors=True)

print("== catalog ==")
def setc(e,key):
    e["version"]=TEXTV; e["audioVersion"]=AUDIOV; e["audioZipBytes"]=fullbytes[key]
    e["deltaZip"]=f"{BASE}/delta-{key}.zip"; e["deltaZipBytes"]=deltas[key]; e["deltaBaseVersion"]=ABASE
setc(cat["core"],"core")
for p in cat["packs"]:
    if p["l1"]=="en": setc(p,"en")
    if p["l1"]=="ja": setc(p,"ja")
catp=os.path.join(DIST,"catalog.json"); wj(catp,cat)
print("  core/en/ja version=%d audioVersion=%d deltaBase=%d"%(TEXTV,AUDIOV,ABASE))

print("== upload ==")
assets=[os.path.join(DIST,n) for n in ("core.json","overlay-ja.json","overlay-en.json",
        "audio-core.zip","audio-en.zip","audio-ja.zip","delta-core.zip","delta-en.zip","delta-ja.zip","catalog.json")]
subprocess.run([GH,"release","upload",TAG,*assets,"--repo",REPO,"--clobber"],check=True)
print("公開完了 →",TAG)
