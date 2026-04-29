// ─────────────────────────────────────────
// AudioModal.jsx
// ─────────────────────────────────────────
import { useRef, useState } from "react";

export function AudioModal({ project, onUpload, onClose }) {
  const [file, setFile]       = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    await onUpload(file);
    setUploading(false);
    onClose();
  }

  return (
    <div style={{ maxWidth: 500, margin: "0 auto" }}>
      <SectionHeader icon="♪" label="AGGIUNGI AUDIO" sub={`Progetto: ${project?.name}`} />

      {project?.audio && (
        <div style={{
          padding: "0.8rem 1rem", background: "#0a0f18",
          border: "1px solid rgba(168,85,247,0.3)",
          borderRadius: "6px", marginBottom: "1rem",
          fontSize: "0.65rem", color: "#a855f7",
        }}>
          ♪ Audio attuale: <strong>{project.audio.name}</strong>
          <br />
          <span style={{ color: "#475569", fontSize: "0.55rem" }}>
            Caricando un nuovo file, quello attuale verrà sostituito.
          </span>
        </div>
      )}

      <div
        onClick={() => fileRef.current.click()}
        style={{
          border: "2px dashed #1e293b",
          borderRadius: "8px", padding: "2.5rem",
          textAlign: "center", cursor: "pointer",
          background: "#0a0f18",
        }}
      >
        <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>♪</div>
        <div style={{ fontSize: "0.65rem", color: "#475569", letterSpacing: "0.1em" }}>
          {file ? file.name : "CLICCA per selezionare audio"}
        </div>
        <div style={{ fontSize: "0.55rem", color: "#334155", marginTop: "0.3rem" }}>
          MP3 · WAV · AAC · OGG
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="audio/*"
          onChange={e => setFile(e.target.files[0])}
          style={{ display: "none" }}
        />
      </div>

      <div style={{ display: "flex", gap: "0.8rem", justifyContent: "flex-end", marginTop: "1.2rem" }}>
        <button onClick={onClose} style={btnSecondary}>ANNULLA</button>
        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          style={{
            ...btnPurple,
            opacity: (!file || uploading) ? 0.5 : 1,
            cursor: (!file || uploading) ? "not-allowed" : "pointer",
          }}
        >
          {uploading ? "CARICAMENTO..." : "♪ AGGIUNGI AUDIO"}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// TemplateModal.jsx
// ─────────────────────────────────────────
const TEMPLATES_FULL = [
  {
    id: "sequence",
    label: "Sequenza",
    icon: "▶",
    desc: "Clip in sequenza lineare con dissolvenza",
    tags: ["foto", "video"],
    color: "#00d4a8",
  },
  {
    id: "slideshow",
    label: "Slideshow Ken Burns",
    icon: "◎",
    desc: "Foto con zoom lento + musica di sottofondo",
    tags: ["foto"],
    color: "#3b82f6",
  },
  {
    id: "grid2x2",
    label: "Griglia 2×2",
    icon: "⊞",
    desc: "4 clip in simultanea — effetto mosaico",
    tags: ["foto", "video"],
    color: "#f59e0b",
  },
  {
    id: "splitv",
    label: "Split Verticale",
    icon: "◫",
    desc: "2 clip affiancate — left/right",
    tags: ["foto", "video"],
    color: "#a855f7",
  },
  {
    id: "splith",
    label: "Split Orizzontale",
    icon: "▭",
    desc: "2 clip sopra/sotto — top/bottom",
    tags: ["foto", "video"],
    color: "#f43f5e",
  },
];

export function TemplateModal({ onSelect }) {
  const [selected, setSelected] = useState(null);

  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      <SectionHeader icon="◫" label="SCEGLI MODELLO" sub="Template FFmpeg preconfigurati" />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1rem" }}>
        {TEMPLATES_FULL.map(t => (
          <div
            key={t.id}
            onClick={() => setSelected(t.id)}
            style={{
              padding: "1.2rem",
              background: selected === t.id ? `${t.color}12` : "#0a0f18",
              border: `1px solid ${selected === t.id ? t.color : "#1e293b"}`,
              borderRadius: "8px",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>{t.icon}</div>
            <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#f8fafc", marginBottom: "0.3rem" }}>
              {t.label}
            </div>
            <div style={{ fontSize: "0.6rem", color: "#475569", lineHeight: 1.5, marginBottom: "0.6rem" }}>
              {t.desc}
            </div>
            <div style={{ display: "flex", gap: "0.3rem" }}>
              {t.tags.map(tag => (
                <span key={tag} style={{
                  fontSize: "0.5rem", letterSpacing: "0.1em",
                  padding: "1px 6px",
                  background: `${t.color}20`,
                  color: t.color,
                  borderRadius: "2px",
                }}>
                  {tag.toUpperCase()}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1.5rem" }}>
          <button
            onClick={() => onSelect(selected)}
            style={btnPrimary}
          >
            ✓ USA {TEMPLATES_FULL.find(t => t.id === selected)?.label.toUpperCase()}
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// RenderStatus.jsx
// ─────────────────────────────────────────
export function RenderStatus({ status, onClose }) {
  const configs = {
    starting:  { color: "#f59e0b", icon: "◌", label: "AVVIO BACKEND..." },
    rendering: { color: "#3b82f6", icon: "◎", label: "RENDERING IN CORSO..." },
    done:      { color: "#00d4a8", icon: "✓", label: "COLLAGE PRONTO" },
    error:     { color: "#f43f5e", icon: "✕", label: "ERRORE RENDERING" },
  };
  const cfg = configs[status.status] || configs.error;

  return (
    <div style={{
      padding: "1rem 1.2rem",
      background: `${cfg.color}10`,
      border: `1px solid ${cfg.color}40`,
      borderRadius: "8px",
      marginBottom: "1.5rem",
      display: "flex",
      alignItems: "center",
      gap: "1rem",
      flexWrap: "wrap",
    }}>
      <span style={{ fontSize: "1.2rem", color: cfg.color }}>{cfg.icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: "0.7rem", fontWeight: 700, color: cfg.color, letterSpacing: "0.15em" }}>
          {cfg.label}
        </div>
        {status.status === "rendering" && (
          <div style={{ fontSize: "0.55rem", color: "#475569", marginTop: "0.2rem" }}>
            Il backend Render si sta svegliando — attendi 30–90 secondi
          </div>
        )}
        {status.status === "error" && (
          <div style={{ fontSize: "0.6rem", color: "#f43f5e", marginTop: "0.2rem" }}>
            {status.message}
          </div>
        )}
      </div>
      {status.status === "done" && status.url && (
        <a
          href={status.url}
          target="_blank"
          rel="noreferrer"
          style={{
            padding: "0.4rem 1rem",
            background: "rgba(0,212,168,0.15)",
            border: "1px solid #00d4a8",
            color: "#00d4a8",
            borderRadius: "4px",
            fontSize: "0.65rem",
            textDecoration: "none",
            letterSpacing: "0.1em",
          }}
        >
          ↓ SCARICA VIDEO
        </a>
      )}
      <button onClick={onClose} style={{
        background: "transparent", border: "none",
        color: "#475569", cursor: "pointer", fontSize: "1rem",
      }}>✕</button>
    </div>
  );
}

// ─────────────────────────────────────────
// Login.jsx
// ─────────────────────────────────────────
import { auth as firebaseAuth } from "../utils/firebase";
import { signInAnonymously, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { useState as useLoginState } from "react";

export function Login() {
  const [loading, setLoading] = useLoginState(false);

  async function handleGoogle() {
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(firebaseAuth, provider);
    } catch (e) {
      alert("Errore login: " + e.message);
      setLoading(false);
    }
  }

  async function handleAnon() {
    setLoading(true);
    try {
      await signInAnonymously(firebaseAuth);
    } catch (e) {
      alert("Errore: " + e.message);
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#080c10",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Courier New', monospace",
      padding: "2rem",
    }}>
      <div style={{
        maxWidth: 380, width: "100%",
        border: "1px solid rgba(0,212,168,0.2)",
        borderRadius: "12px",
        padding: "2.5rem",
        background: "#0a0f18",
        textAlign: "center",
      }}>
        <div style={{ fontSize: "0.6rem", color: "#00d4a8", letterSpacing: "0.3em", marginBottom: "0.5rem" }}>
          ◈ TASKTOOLS HUB
        </div>
        <h1 style={{
          fontSize: "1.4rem", fontWeight: 900,
          color: "#f8fafc", margin: "0 0 0.3rem",
          letterSpacing: "-0.02em",
        }}>
          COLLAGE <span style={{ color: "#00d4a8" }}>CREATOR</span>
        </h1>
        <p style={{ fontSize: "0.6rem", color: "#475569", marginBottom: "2rem", letterSpacing: "0.1em" }}>
          Laboratorio sperimentale LLM · Open Source
        </p>

        <button
          onClick={handleGoogle}
          disabled={loading}
          style={{
            width: "100%", padding: "0.8rem",
            background: "rgba(0,212,168,0.1)",
            border: "1px solid rgba(0,212,168,0.4)",
            color: "#00d4a8",
            borderRadius: "6px",
            fontSize: "0.7rem",
            cursor: loading ? "not-allowed" : "pointer",
            fontFamily: "'Courier New', monospace",
            letterSpacing: "0.15em",
            marginBottom: "0.8rem",
            transition: "all 0.15s",
          }}
        >
          {loading ? "..." : "G  ACCEDI CON GOOGLE"}
        </button>

        <button
          onClick={handleAnon}
          disabled={loading}
          style={{
            width: "100%", padding: "0.6rem",
            background: "transparent",
            border: "1px solid #1e293b",
            color: "#475569",
            borderRadius: "6px",
            fontSize: "0.6rem",
            cursor: loading ? "not-allowed" : "pointer",
            fontFamily: "'Courier New', monospace",
            letterSpacing: "0.15em",
          }}
        >
          ACCESSO ANONIMO (demo)
        </button>

        <p style={{ fontSize: "0.5rem", color: "#334155", marginTop: "1.5rem", lineHeight: 1.6 }}>
          MIT License · github.com/TaskToolsHub<br />
          I tuoi file vengono eliminati automaticamente dopo 7 giorni
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────
function SectionHeader({ icon, label, sub }) {
  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <div style={{ fontSize: "0.6rem", color: "#00d4a8", letterSpacing: "0.3em", marginBottom: "0.3rem" }}>
        {icon} {label}
      </div>
      {sub && <div style={{ fontSize: "0.65rem", color: "#475569" }}>{sub}</div>}
    </div>
  );
}

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

const btnPurple = {
  padding: "0.5rem 1.5rem",
  background: "rgba(168,85,247,0.15)",
  border: "1px solid #a855f7",
  color: "#a855f7",
  borderRadius: "4px",
  fontSize: "0.65rem",
  cursor: "pointer",
  fontFamily: "'Courier New', monospace",
  letterSpacing: "0.15em",
  fontWeight: 700,
};
