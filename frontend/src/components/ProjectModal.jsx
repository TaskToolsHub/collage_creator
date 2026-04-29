import { useState, useRef } from "react";

const TEMPLATES = [
  { id: "sequence",   label: "Sequenza",      desc: "Clip in sequenza con dissolvenza" },
  { id: "slideshow",  label: "Slideshow",     desc: "Foto con zoom Ken Burns + audio" },
  { id: "grid2x2",    label: "Griglia 2×2",   desc: "4 clip simultanee a schermo" },
  { id: "splitv",     label: "Split V",       desc: "2 clip affiancate verticalmente" },
  { id: "splith",     label: "Split H",       desc: "2 clip affiancate orizzontalmente" },
];

export default function ProjectModal({ mode, project, onSave, onCancel }) {
  const [name, setName]           = useState(project?.name || "");
  const [template, setTemplate]   = useState(project?.template || "sequence");
  const [files, setFiles]         = useState([]);
  const [media, setMedia]         = useState(project?.media || []); // existing
  const [dragging, setDragging]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [dragIdx, setDragIdx]     = useState(null);
  const fileRef = useRef();

  // ── Drag & drop upload ──────────────────────────────────
  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter(f =>
      f.type.startsWith("image/") || f.type.startsWith("video/")
    );
    setFiles(prev => [...prev, ...dropped]);
  }

  function handleFileInput(e) {
    const selected = Array.from(e.target.files).filter(f =>
      f.type.startsWith("image/") || f.type.startsWith("video/")
    );
    setFiles(prev => [...prev, ...selected]);
  }

  // ── Drag to reorder existing media ─────────────────────
  function moveMedia(fromIdx, toIdx) {
    const arr = [...media];
    const [item] = arr.splice(fromIdx, 1);
    arr.splice(toIdx, 0, item);
    setMedia(arr);
  }

  function removeExisting(idx) {
    setMedia(prev => prev.filter((_, i) => i !== idx));
  }

  function removeNew(idx) {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  }

  // ── Save ───────────────────────────────────────────────
  async function handleSave() {
    if (!name.trim()) { alert("Inserisci un nome per il progetto."); return; }
    setSaving(true);
    if (mode === "create") {
      await onSave({ name: name.trim(), template, files });
    } else {
      await onSave({ name: name.trim(), template, media, newFiles: files });
    }
    setSaving(false);
  }

  const totalCount = media.length + files.length;

  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div style={{ fontSize: "0.6rem", color: "#00d4a8", letterSpacing: "0.3em", marginBottom: "0.3rem" }}>
          {mode === "create" ? "⊕ NUOVO PROGETTO" : "✎ MODIFICA PROGETTO"}
        </div>
        <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "#f8fafc" }}>
          {mode === "create" ? "Crea Collage" : project?.name}
        </div>
      </div>

      {/* Name */}
      <div style={{ marginBottom: "1.2rem" }}>
        <Label>NOME PROGETTO</Label>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="es. Video Benvenuto YouTube"
          style={inputStyle}
        />
      </div>

      {/* Template */}
      <div style={{ marginBottom: "1.5rem" }}>
        <Label>MODELLO DI LAYOUT</Label>
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
          {TEMPLATES.map(t => (
            <button
              key={t.id}
              onClick={() => setTemplate(t.id)}
              style={{
                padding: "0.5rem 0.9rem",
                background: template === t.id ? "rgba(0,212,168,0.15)" : "#0a0f18",
                border: `1px solid ${template === t.id ? "#00d4a8" : "#1e293b"}`,
                color: template === t.id ? "#00d4a8" : "#64748b",
                borderRadius: "6px",
                cursor: "pointer",
                fontFamily: "'Courier New', monospace",
                fontSize: "0.65rem",
                letterSpacing: "0.1em",
                transition: "all 0.15s",
              }}
            >
              <div style={{ fontWeight: 700 }}>{t.label}</div>
              <div style={{ fontSize: "0.5rem", color: template === t.id ? "#6ee7d4" : "#334155", marginTop: "2px" }}>
                {t.desc}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Existing media reorder (edit mode) */}
      {mode === "edit" && media.length > 0 && (
        <div style={{ marginBottom: "1.2rem" }}>
          <Label>ORDINE MEDIA (trascina per riordinare)</Label>
          <div style={{
            display: "flex", gap: "6px", flexWrap: "wrap",
            marginTop: "0.5rem", padding: "0.8rem",
            border: "1px solid rgba(0,212,168,0.15)",
            borderRadius: "6px", background: "#0a0f18",
          }}>
            {media.map((m, i) => (
              <div
                key={i}
                draggable
                onDragStart={() => setDragIdx(i)}
                onDragOver={e => e.preventDefault()}
                onDrop={() => { moveMedia(dragIdx, i); setDragIdx(null); }}
                style={{
                  width: 56, height: 72, borderRadius: "4px",
                  overflow: "hidden", position: "relative",
                  cursor: "grab", border: "1px solid #1e293b",
                  background: "#1e293b",
                }}
              >
                {m.type?.startsWith("video") ? (
                  <video src={m.url} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
                ) : (
                  <img src={m.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                )}
                <div style={{
                  position: "absolute", bottom: 0, left: 0, right: 0,
                  background: "rgba(0,0,0,0.6)",
                  fontSize: "0.45rem", color: "#94a3b8",
                  padding: "2px 4px", display: "flex", justifyContent: "space-between",
                }}>
                  <span>{i + 1}</span>
                  <span
                    onClick={() => removeExisting(i)}
                    style={{ color: "#f43f5e", cursor: "pointer" }}
                  >✕</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Drop zone */}
      <div style={{ marginBottom: "1.5rem" }}>
        <Label>
          {mode === "edit" ? "AGGIUNGI NUOVI MEDIA" : "MEDIA"} — foto o video (max 15 sec)
        </Label>
        <div
          onDrop={handleDrop}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onClick={() => fileRef.current.click()}
          style={{
            marginTop: "0.5rem",
            border: `2px dashed ${dragging ? "#00d4a8" : "#1e293b"}`,
            borderRadius: "8px",
            padding: "2rem",
            textAlign: "center",
            cursor: "pointer",
            background: dragging ? "rgba(0,212,168,0.05)" : "#0a0f18",
            transition: "all 0.2s",
          }}
        >
          <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>⊕</div>
          <div style={{ fontSize: "0.65rem", color: "#475569", letterSpacing: "0.1em" }}>
            TRASCINA QUI o clicca per selezionare
          </div>
          <div style={{ fontSize: "0.55rem", color: "#334155", marginTop: "0.3rem" }}>
            JPG · PNG · MP4 · MOV · WEBM
          </div>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept="image/*,video/*"
            onChange={handleFileInput}
            style={{ display: "none" }}
          />
        </div>

        {/* New files preview */}
        {files.length > 0 && (
          <div style={{
            display: "flex", gap: "6px", flexWrap: "wrap",
            marginTop: "0.8rem",
          }}>
            {files.map((f, i) => (
              <div key={i} style={{
                position: "relative", width: 56, height: 72,
                borderRadius: "4px", background: "#1e293b",
                border: "1px solid rgba(0,212,168,0.3)",
                overflow: "hidden",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {f.type.startsWith("video") ? (
                  <span style={{ fontSize: "1.2rem" }}>▶</span>
                ) : (
                  <img
                    src={URL.createObjectURL(f)}
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                )}
                <div style={{
                  position: "absolute", bottom: 0, left: 0, right: 0,
                  background: "rgba(0,0,0,0.7)", fontSize: "0.45rem",
                  padding: "2px 4px", display: "flex", justifyContent: "space-between",
                  color: "#00d4a8",
                }}>
                  <span>NEW</span>
                  <span onClick={() => removeNew(i)} style={{ color: "#f43f5e", cursor: "pointer" }}>✕</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalCount > 0 && (
          <div style={{ fontSize: "0.6rem", color: "#475569", marginTop: "0.5rem" }}>
            {totalCount} file selezionati
          </div>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "0.8rem", justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={btnSecondary}>ANNULLA</button>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            ...btnPrimary,
            opacity: saving ? 0.6 : 1,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "SALVATAGGIO..." : mode === "create" ? "⊕ CREA PROGETTO" : "✓ SALVA MODIFICHE"}
        </button>
      </div>
    </div>
  );
}

function Label({ children }) {
  return (
    <div style={{
      fontSize: "0.6rem", color: "#475569",
      letterSpacing: "0.2em", marginBottom: "0.4rem",
    }}>
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%", boxSizing: "border-box",
  background: "#0a0f18",
  border: "1px solid #1e293b",
  borderRadius: "6px",
  padding: "0.6rem 0.8rem",
  color: "#f8fafc",
  fontFamily: "'Courier New', monospace",
  fontSize: "0.8rem",
  outline: "none",
};

const btnSecondary = {
  padding: "0.5rem 1.2rem",
  background: "transparent",
  border: "1px solid #1e293b",
  color: "#475569",
  borderRadius: "4px",
  fontSize: "0.65rem",
  cursor: "pointer",
  fontFamily: "'Courier New', monospace",
  letterSpacing: "0.15em",
};

const btnPrimary = {
  padding: "0.5rem 1.5rem",
  background: "rgba(0,212,168,0.15)",
  border: "1px solid #00d4a8",
  color: "#00d4a8",
  borderRadius: "4px",
  fontSize: "0.65rem",
  cursor: "pointer",
  fontFamily: "'Courier New', monospace",
  letterSpacing: "0.15em",
  fontWeight: 700,
};
