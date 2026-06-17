# App B: 17-1-14「メールで送ります。」差分公開 (packs-appb-v2)
#  TEXT: core.json(examplesJp+jpReading) / overlay-{en,ne,bn,vi,zh}(examplesL1+convVocab) を版1003へ
#  AUDIO: ja(core)/en/ne/bn/vi/zh の 17-1-14 を差し替え、full zip更新 + delta(1ファイル) audioVersion+1
import os, json, shutil, subprocess, tempfile, urllib.request, zipfile, copy, time
def safe_replace(src,dst):
    for a in range(8):
        try: os.replace(src,dst); return
        except PermissionError:
            time.sleep(0.5*(a+1))
    os.replace(src,dst)
APP=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST=os.path.join(APP,"dist-packs"); os.makedirs(DIST,exist_ok=True)
REPO="JinKato2020/safa-language-apps"; TAG="packs-appb-v2"
BASE=f"https://github.com/{REPO}/releases/download/{TAG}"
FFMPEG=shutil.which("ffmpeg") or "ffmpeg"; GH=shutil.which("gh") or "gh"
ID="17-1-14"; KEY="17-1"; I=13; TEXTV=1003
OLD_RD="ラインで送ります。"; NEW_JA="メールで送ります。"
RD={"kana":"メールで おくります。","romaji":"Meeru de okurimasu."}
# overlay L1 new examplesL1 text
NEW_L1={"en":"I'll send it by email.","ne":"इमेलबाट पठाउँछु।","bn":"ইমেইলে পাঠিয়ে দিচ্ছি।",
        "vi":"Tôi sẽ gửi qua email.","zh":"我用电子邮件发给你。"}
# audio: key -> (lang dir, full zip name, current audioVersion)
AU={"core":("ja","audio-core.zip",1001),"en":("en","audio-en.zip",1001),"ne":("ne","audio-ne.zip",1001),
    "bn":("bn","audio-bn.zip",1000),"vi":("vi","audio-vi.zip",1000),"zh":("zh","audio-zh.zip",1000)}

def dl(name):
    p=os.path.join(DIST,name); urllib.request.urlretrieve(BASE+f"/{name}?t=pub", p); return p
def rj(p): return json.load(open(p,encoding="utf-8"))
def wj(p,d): json.dump(d,open(p,"w",encoding="utf-8"),ensure_ascii=False)
def enc32k(src,dst):
    r=subprocess.run([FFMPEG,"-y","-loglevel","error","-i",src,"-ar","24000","-ac","1","-b:a","32k","-map_metadata","-1",dst],capture_output=True)
    if r.returncode!=0 or not os.path.exists(dst): raise RuntimeError("ffmpeg "+src+" "+r.stderr.decode()[:200])
    return dst if os.path.getsize(dst)<os.path.getsize(src) else src
def mig(cv):  # convVocab: ライン -> メール (Japanese-keyed)
    if "ライン" in cv: cv["ライン"]["contexts"]=[c for c in cv["ライン"]["contexts"] if c.get("sentence_id")!=ID]
    if "メール" in cv and not any(c.get("sentence_id")==ID for c in cv["メール"]["contexts"]):
        t=copy.deepcopy(cv["メール"]["contexts"][0]); t["sentence_id"]=ID; t.pop("note",None); cv["メール"]["contexts"].append(t)

print("== download text ==")
core=rj(dl("core.json")); cat=rj(dl("catalog.json"))
ovs={l:rj(dl(f"overlay-{l}.json")) for l in NEW_L1}

print("== patch text ==")
core["examplesJp"][KEY][I]=NEW_JA
jr=core["jpReading"]; jr.pop(OLD_RD,None); jr[NEW_JA]=RD
for l,o in ovs.items():
    o["examplesL1"][KEY][I]=NEW_L1[l]; mig(o["convVocab"]); o["version"]=TEXTV
wj(os.path.join(DIST,"core.json"),core)
for l,o in ovs.items(): wj(os.path.join(DIST,f"overlay-{l}.json"),o)

print("== audio: enc32k + swap into full zip + delta ==")
tmp=tempfile.mkdtemp(prefix="meruB_"); fullbytes={}; deltas={}
for key,(lang,zipn,_av) in AU.items():
    dl(zipn)
    src=os.path.join(APP,"audio",lang,"conv",ID+".mp3")
    enc=enc32k(src, os.path.join(tmp,f"{key}.mp3"))
    full=os.path.join(DIST,zipn); tmpfull=full+".new"
    with zipfile.ZipFile(full) as zin, zipfile.ZipFile(tmpfull,"w",zipfile.ZIP_STORED) as zout:
        for it in zin.infolist():
            if it.filename==ID+".mp3": continue
            zout.writestr(it, zin.read(it.filename))
        zout.write(enc, ID+".mp3")
    safe_replace(tmpfull,full); fullbytes[key]=os.path.getsize(full)
    dz=os.path.join(DIST,f"delta-{key}.zip")
    with zipfile.ZipFile(dz,"w",zipfile.ZIP_STORED) as z: z.write(enc, ID+".mp3")
    deltas[key]=os.path.getsize(dz)
    print(f"  {key}({lang}): full={fullbytes[key]/1e6:.1f}MB delta={deltas[key]}B")
shutil.rmtree(tmp,ignore_errors=True)

print("== catalog ==")
def setc(e,key):
    base=AU[key][2]
    e["version"]=TEXTV; e["audioVersion"]=base+1; e["audioZipBytes"]=fullbytes[key]
    e["deltaZip"]=f"{BASE}/delta-{key}.zip"; e["deltaZipBytes"]=deltas[key]; e["deltaBaseVersion"]=base
setc(cat["core"],"core")
L2KEY={"en":"en","ne":"ne","bn":"bn","vi":"vi","zh":"zh"}
for p in cat["packs"]:
    if p["l1"] in L2KEY: setc(p,L2KEY[p["l1"]])
catp=os.path.join(DIST,"catalog.json"); wj(catp,cat)
print("  text version=%d ; audioVersion bumped per-lang"%TEXTV)

print("== upload ==")
names=["core.json"]+[f"overlay-{l}.json" for l in NEW_L1] \
      +[AU[k][1] for k in AU]+[f"delta-{k}.zip" for k in AU]+["catalog.json"]
assets=[os.path.join(DIST,n) for n in names]
subprocess.run([GH,"release","upload",TAG,*assets,"--repo",REPO,"--clobber"],check=True)
print("done ->",TAG)
