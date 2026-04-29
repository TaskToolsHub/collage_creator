import { useState, useEffect } from "react";
import { db, auth, RENDER_API_URL } from "../utils/firebase";
import { collection, addDoc, getDocs, deleteDoc, doc, query, where, orderBy, serverTimestamp } from "firebase/firestore";
import { signOut } from "firebase/auth";

const TEMPLATES = [
  { id: "sequence",  label: "Sequenza",    desc: "Clip in sequenza con dissolvenza" },
  { id: "slideshow", label: "Slideshow",   desc: "Foto con zoom Ken Burns + audio" },
  { id: "grid2x2",   label: "Griglia 2x2", desc: "4 clip simultanee" },
  { id: "splitv",    label: "Split V",     desc: "2 clip affiancate verticalmente" },
  { id: "splith",    label: "Split H",     desc: "2 clip affiancate orizzontalmente" },
];

export default function Dashboard({ user }) {
  const [tab, setTab] = useState("create");
  const [history, setHistory] = useState([]);
  const [name, setName] = useState("");
  const [template, setTemplate] = useState("sequence");
  const [files, setFiles] = useState([]);
  const [audioFile, setAudioFile] = useState(null);
  const [status, setStatus] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [dragging, setDragging] = useState(false);

  useEffect(() => { fetch(RENDER_API_URL + "/").catch(() => {}); }, []);
  useEffect(() => { loadHistory(); }, [user]);

  async function loadHistory() {
    try {
      const q = query(collection(db, "projects"), where("uid", "==", user.uid), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const now = Date.now();
      const WEEK = 7*24*60*60*1000;
      for (const d of docs) {
        if (d.createdAt && (now - d.createdAt.toMillis()) > WEEK) {
          try { await deleteDoc(doc(db, "projects", d.id)); } catch {}
        }
      }
      setHistory(docs.filter(d => !d.createdAt || (now - d.createdAt.toMillis()) <= WEEK));
    } catch (e) { console.error(e); }
  }

  function handleDrop(e) {
    e.preventDefault(); setDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/") || f.type.startsWith("video/"));
    setFiles(prev => [...prev, ...dropped]);
  }

  function removeFile(idx) { setFiles(prev => prev.filter((_, i) => i !== idx)); }

  async function handleGenerate() {
    if (!name.trim()) { alert("Inserisci un nome."); return; }
    if (!files.length) { alert("Aggiungi almeno una foto."); return; }
    setStatus("generating"); setVideoUrl(null); setErrorMsg("");
    try {
      const fd = new FormData();
      fd.append("projectName", name.trim());
      fd.append("template", template);
      fd.append("uid", user.uid);
      files.forEach(f => fd.append("media", f));
      if (audioFile) fd.append("audio", audioFile);
      const res = await fetch(RENDER_API_URL + "/render", { method: "POST", body: fd });
      if (!res.ok) { const t = await res.text(); throw new Error("Backend: " + t); }
      const blob = await res.blob();
      setVideoUrl(URL.createObjectURL(blob));
      setStatus("done");
      await addDoc(collection(db, "projects"), { uid: user.uid, name: name.trim(), template, mediaCount: files.length, hasAudio: !!audioFile, createdAt: serverTimestamp() });
      await loadHistory();
    } catch (e) { console.error(e); setStatus("error"); setErrorMsg(e.message); }
  }

  const S = {
    hdr: { background: "#0a0f18", borderBottom: "1px solid rgba(0,212,168,0.15)", padding: "0.75rem 1.5rem", display: "flex", alignItems: "center", gap: "1rem", position: "sticky", top: 0, zIndex: 50 },
    lbl: { fontSize: "0.6rem", color: "#475569", letterSpacing: "0.2em", marginBottom: "0.4rem" },
    inp: { width: "100%", boxSizing: "border-box", background: "#0a0f18", border: "1px solid #1e293b", borderRadius: "6px", padding: "0.6rem 0.8rem", color: "#f8fafc", fontFamily: "'Courier New', monospace", fontSize: "0.8rem", outline: "none" },
  };

  return (
    <div style={{ minHeight: "100vh", background: "#080c10", fontFamily: "'Courier New', monospace", color: "#e2e8f0", display: "flex", flexDirection: "column" }}>
      <header style={S.hdr}>
        <div>
          <div style={{ fontSize: "0.55rem", letterSpacing: "0.3em", color: "#00d4a8" }}>TASKTOOLS HUB</div>
          <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "#f8fafc" }}>COLLAGE <span style={{ color: "#00d4a8" }}>CREATOR</span></div>
        </div>
        <button onClick={() => signOut(auth)} style={{ marginLeft: "auto", background: "transparent", border: "1px solid #1e293b", color: "#475569", padding: "0.3rem 0.8rem", borderRadius: "4px", fontSize: "0.6rem", cursor: "pointer", fontFamily: "'Courier New', monospace" }}>ESCI</button>
      </header>
      <nav style={{ display: "flex", borderBottom: "1px solid rgba(0,212,168,0.1)", background: "#0a0f18" }}>
        {[{id:"create",label:"CREA COLLAGE"},{id:"history",label:"STORICO"}].map(n=>(
          <button key={n.id} onClick={()=>setTab(n.id)} style={{ padding: "0.75rem 1.2rem", background: "transparent", border: "none", borderBottom: tab===n.id?"2px solid #00d4a8":"2px solid transparent", color: tab===n.id?"#00d4a8":"#475569", cursor: "pointer", fontSize: "0.65rem", letterSpacing: "0.2em", fontFamily: "'Courier New', monospace" }}>{n.label}</button>
        ))}
      </nav>
      <main style={{ flex: 1, padding: "1.5rem", maxWidth: 800, margin: "0 auto", width: "100%" }}>
        {tab==="create" && (<div>
          <div style={{ marginBottom: "1.5rem" }}>
            <div style={{ fontSize: "0.6rem", color: "#00d4a8", letterSpacing: "0.3em" }}>NUOVO COLLAGE</div>
            <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "#f8fafc" }}>Crea il tuo video</div>
          </div>
          <div style={{ marginBottom: "1.2rem" }}>
            <div style={S.lbl}>NOME PROGETTO</div>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="es. Video YouTube" style={S.inp} />
          </div>
          <div style={{ marginBottom: "1.5rem" }}>
            <div style={S.lbl}>MODELLO DI LAYOUT</div>
            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
              {TEMPLATES.map(t=>(
                <button key={t.id} onClick={()=>setTemplate(t.id)} style={{ padding: "0.5rem 0.9rem", background: template===t.id?"rgba(0,212,168,0.15)":"#0a0f18", border: "1px solid "+(template===t.id?"#00d4a8":"#1e293b"), color: template===t.id?"#00d4a8":"#64748b", borderRadius: "6px", cursor: "pointer", fontFamily: "'Courier New', monospace", fontSize: "0.65rem" }}>
                  <div style={{ fontWeight: 700 }}>{t.label}</div>
                  <div style={{ fontSize: "0.5rem", color: template===t.id?"#6ee7d4":"#334155", marginTop: "2px" }}>{t.desc}</div>
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: "1.5rem" }}>
            <div style={S.lbl}>MEDIA</div>
            <div onDrop={handleDrop} onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onClick={()=>document.getElementById("fileInput").click()} style={{ marginTop: "0.5rem", border: "2px dashed "+(dragging?"#00d4a8":"#1e293b"), borderRadius: "8px", padding: "2rem", textAlign: "center", cursor: "pointer", background: dragging?"rgba(0,212,168,0.05)":"#0a0f18" }}>
              <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>+</div>
              <div style={{ fontSize: "0.65rem", color: "#475569" }}>TRASCINA QUI o clicca</div>
              <div style={{ fontSize: "0.55rem", color: "#334155", marginTop: "0.3rem" }}>JPG PNG MP4 MOV WEBM</div>
              <input id="fileInput" type="file" multiple accept="image/*,video/*" onChange={e=>setFiles(prev=>[...prev,...Array.from(e.target.files)])} style={{ display: "none" }} />
            </div>
            {files.length>0 && (
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "0.8rem" }}>
                {files.map((f,i)=>(
                  <div key={i} style={{ position: "relative", width: 56, height: 72, borderRadius: "4px", background: "#1e293b", border: "1px solid rgba(0,212,168,0.3)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {f.type.startsWith("video")?<span>V</span>:<img src={URL.createObjectURL(f)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.7)", fontSize: "0.45rem", padding: "2px 4px", display: "flex", justifyContent: "space-between", color: "#00d4a8" }}>
                      <span>{i+1}</span>
                      <span onClick={e=>{e.stopPropagation();removeFile(i);}} style={{ color: "#f43f5e", cursor: "pointer" }}>x</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {files.length>0 && <div style={{ fontSize: "0.6rem", color: "#475569", marginTop: "0.5rem" }}>{files.length} file</div>}
          </div>
          <div style={{ marginBottom: "1.5rem" }}>
            <div style={S.lbl}>AUDIO (opzionale)</div>
            <div onClick={()=>document.getElementById("audioInput").click()} style={{ border: "1px dashed #1e293b", borderRadius: "6px", padding: "1rem", textAlign: "center", cursor: "pointer", background: "#0a0f18" }}>
              <div style={{ fontSize: "0.65rem", color: "#a855f7" }}>{audioFile?audioFile.name:"Clicca per aggiungere musica"}</div>
              <input id="audioInput" type="file" accept="audio/*" onChange={e=>setAudioFile(e.target.files[0])} style={{ display: "none" }} />
            </div>
            {audioFile && <button onClick={()=>setAudioFile(null)} style={{ marginTop: "0.3rem", background: "transparent", border: "none", color: "#f43f5e", fontSize: "0.55rem", cursor: "pointer" }}>x Rimuovi</button>}
          </div>
          {status==="generating" && <div style={{ padding: "1rem", background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.4)", borderRadius: "8px", marginBottom: "1.5rem", textAlign: "center" }}><div style={{ fontSize: "0.7rem", color: "#3b82f6", fontWeight: 700 }}>RENDERING...</div><div style={{ fontSize: "0.55rem", color: "#475569", marginTop: "0.3rem" }}>Attendi 30-90 secondi</div></div>}
          {status==="done" && videoUrl && <div style={{ padding: "1rem", background: "rgba(0,212,168,0.1)", border: "1px solid rgba(0,212,168,0.4)", borderRadius: "8px", marginBottom: "1.5rem", textAlign: "center" }}><div style={{ fontSize: "0.7rem", color: "#00d4a8", fontWeight: 700 }}>COLLAGE PRONTO!</div><a href={videoUrl} download={name.trim()+".mp4"} style={{ display: "inline-block", marginTop: "0.8rem", padding: "0.5rem 1.5rem", background: "rgba(0,212,168,0.15)", border: "1px solid #00d4a8", color: "#00d4a8", borderRadius: "4px", fontSize: "0.7rem", textDecoration: "none", fontFamily: "'Courier New', monospace" }}>SCARICA VIDEO</a></div>}
          {status==="error" && <div style={{ padding: "1rem", background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.4)", borderRadius: "8px", marginBottom: "1.5rem" }}><div style={{ fontSize: "0.7rem", color: "#f43f5e", fontWeight: 700 }}>ERRORE</div><div style={{ fontSize: "0.6rem", color: "#f43f5e", marginTop: "0.3rem" }}>{errorMsg}</div></div>}
          <div style={{ textAlign: "center", marginTop: "1rem" }}>
            <button onClick={handleGenerate} disabled={status==="generating"} style={{ padding: "0.8rem 2rem", background: status==="generating"?"#1e293b":"rgba(0,212,168,0.15)", border: "1px solid "+(status==="generating"?"#334155":"#00d4a8"), color: status==="generating"?"#475569":"#00d4a8", borderRadius: "6px", fontSize: "0.75rem", cursor: status==="generating"?"not-allowed":"pointer", fontFamily: "'Courier New', monospace", letterSpacing: "0.15em", fontWeight: 700 }}>
              {status==="generating"?"ELABORAZIONE...":"GENERA COLLAGE"}
            </button>
          </div>
        </div>)}
        {tab==="history" && (<div>
          <div style={{ marginBottom: "1.5rem" }}>
            <div style={{ fontSize: "0.6rem", color: "#00d4a8", letterSpacing: "0.3em" }}>STORICO</div>
            <div style={{ fontSize: "0.65rem", color: "#475569" }}>Auto-eliminazione dopo 7 giorni</div>
          </div>
          {!history.length?(<div style={{ textAlign: "center", padding: "3rem", border: "1px dashed rgba(0,212,168,0.2)", borderRadius: "8px" }}><div style={{ color: "#475569", fontSize: "0.7rem" }}>Nessun collage generato</div></div>):(
            <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}>
              {history.map(p=>(
                <div key={p.id} style={{ background: "#0a0f18", border: "1px solid rgba(0,212,168,0.12)", borderRadius: "8px", padding: "0.9rem 1.2rem", display: "flex", alignItems: "center", gap: "1rem" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00d4a8" }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#f8fafc" }}>{p.name}</div>
                    <div style={{ fontSize: "0.55rem", color: "#475569", marginTop: "0.2rem" }}>{p.mediaCount||0} MEDIA - {(p.template||"sequence").toUpperCase()}{p.hasAudio?" - AUDIO":""}</div>
                  </div>
                  <button onClick={async()=>{await deleteDoc(doc(db,"projects",p.id));loadHistory();}} style={{ background: "transparent", border: "1px solid rgba(244,63,94,0.3)", color: "#f43f5e", padding: "0.3rem 0.6rem", borderRadius: "4px", fontSize: "0.55rem", cursor: "pointer", fontFamily: "'Courier New', monospace" }}>x</button>
                </div>
              ))}
            </div>
          )}
        </div>)}
      </main>
    </div>
  );
}
