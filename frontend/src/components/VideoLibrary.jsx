import { useState } from "react";

const STATUS_COLOR = {
  rendered: "#00d4a8",
  pending:  "#f59e0b",
  error:    "#f43f5e",
};

export default function VideoLibrary({ projects, loading, onEdit, onDelete, onRender, onAddAudio }) {
  const [rendering, setRendering] = useState(null);

  async function handleRender(project) {
    setRendering(project.id);
    await onRender(project);
    setRendering(null);
  }

  if (loading) return (
    <div style={{ textAlign: "center", color: "#475569", padding: "3rem", fontSize: "0.7rem", letterSpacing: "0.2em" }}>
      ◈ CARICAMENTO PROGETTI...
    </div>
  );

  if (!projects.length) return (
    <div style={{
      textAlign: "center", padding: "4rem 2rem",
      border: "1px dashed rgba(0,212,168,0.2)",
      borderRadius: "8px",
    }}>
      <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>◫</div>
      <div style={{ color: "#475569", fontSize: "0.7rem", letterSpacing: "0.2em" }}>
        NESSUN PROGETTO
      </div>
      <div style={{ color: "#334155", fontSize: "0.6rem", marginTop: "0.5rem" }}>
        Usa ⊕ AGGIUNGI per creare il tuo primo collage
      </div>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{
        fontSize: "0.6rem", color: "#475569",
        letterSpacing: "0.2em", marginBottom: "0.5rem",
      }}>
        {projects.length} PROGETTI · ORDINATI PER DATA
      </div>

      {projects.map(p => {
        const hasRendered = !!p.renderedUrl;
        const isRendering = rendering === p.id;
        const mediaCount  = p.media?.length || 0;
        const hasAudio    = !!p.audio;

        return (
          <div key={p.id} style={{
            background: "#0a0f18",
            border: "1px solid rgba(0,212,168,0.12)",
            borderRadius: "8px",
            overflow: "hidden",
            transition: "border-color 0.2s",
          }}
            onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(0,212,168,0.35)"}
            onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(0,212,168,0.12)"}
          >
            {/* Project header */}
            <div style={{
              padding: "0.9rem 1.2rem",
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              flexWrap: "wrap",
            }}>
              {/* Status dot */}
              <div style={{
                width: 8, height: 8, borderRadius: "50%",
                background: hasRendered ? STATUS_COLOR.rendered : STATUS_COLOR.pending,
                flexShrink: 0,
              }} />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: "0.85rem", fontWeight: 700,
                  color: "#f8fafc", whiteSpace: "nowrap",
                  overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {p.name}
                </div>
                <div style={{
                  fontSize: "0.55rem", color: "#475569",
                  marginTop: "0.2rem", letterSpacing: "0.1em",
                }}>
                  {mediaCount} MEDIA · TEMPLATE: {(p.template || "sequence").toUpperCase()}
                  {hasAudio ? " · ♪ AUDIO" : ""}
                  {hasRendered ? " · ✓ RENDERIZZATO" : ""}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <ActionBtn onClick={() => onEdit(p)} color="#3b82f6" label="MODIFICA" icon="✎" />
                <ActionBtn onClick={() => onAddAudio(p)} color="#a855f7" label="AUDIO" icon="♪" />
                <ActionBtn
                  onClick={() => handleRender(p)}
                  color="#00d4a8"
                  label={isRendering ? "..." : "GENERA"}
                  icon="▶"
                  disabled={isRendering || mediaCount === 0}
                />
                {hasRendered && (
                  <a
                    href={p.renderedUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      padding: "0.3rem 0.7rem",
                      background: "rgba(0,212,168,0.1)",
                      border: "1px solid rgba(0,212,168,0.4)",
                      color: "#00d4a8",
                      borderRadius: "4px",
                      fontSize: "0.6rem",
                      letterSpacing: "0.1em",
                      textDecoration: "none",
                      display: "flex", alignItems: "center", gap: "0.3rem",
                    }}
                  >
                    ↓ SCARICA
                  </a>
                )}
                <ActionBtn onClick={() => onDelete(p)} color="#f43f5e" label="ELIMINA" icon="✕" />
              </div>
            </div>

            {/* Media preview strip */}
            {mediaCount > 0 && (
              <div style={{
                display: "flex", gap: "4px",
                padding: "0 1.2rem 0.9rem",
                overflowX: "auto",
              }}>
                {p.media.slice(0, 8).map((m, i) => (
                  <div key={i} style={{
                    width: 48, height: 64, flexShrink: 0,
                    borderRadius: "4px", overflow: "hidden",
                    background: "#1e293b",
                    border: "1px solid rgba(255,255,255,0.05)",
                    position: "relative",
                  }}>
                    {m.type?.startsWith("video") ? (
                      <>
                        <video src={m.url} style={{ width: "100%", height: "100%", objectFit: "cover" }} muted />
                        <div style={{
                          position: "absolute", inset: 0,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: "rgba(0,0,0,0.4)",
                          fontSize: "0.8rem",
                        }}>▶</div>
                      </>
                    ) : (
                      <img src={m.url} alt={m.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    )}
                    <div style={{
                      position: "absolute", bottom: 2, right: 3,
                      fontSize: "0.45rem", color: "#94a3b8",
                    }}>
                      {String(i + 1).padStart(2, "0")}
                    </div>
                  </div>
                ))}
                {mediaCount > 8 && (
                  <div style={{
                    width: 48, height: 64, flexShrink: 0,
                    borderRadius: "4px",
                    background: "#1e293b",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "0.6rem", color: "#475569",
                  }}>
                    +{mediaCount - 8}
                  </div>
                )}
              </div>
            )}

            {/* Render progress bar */}
            {isRendering && (
              <div style={{ height: 2, background: "#1e293b" }}>
                <div style={{
                  height: "100%", background: "#00d4a8",
                  animation: "progress-pulse 1.5s ease-in-out infinite",
                  width: "60%",
                }} />
              </div>
            )}
          </div>
        );
      })}

      <style>{`
        @keyframes progress-pulse {
          0%   { width: 10%; }
          50%  { width: 80%; }
          100% { width: 10%; }
        }
      `}</style>
    </div>
  );
}

function ActionBtn({ onClick, color, label, icon, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "0.3rem 0.7rem",
        background: disabled ? "#1e293b" : `${color}18`,
        border: `1px solid ${disabled ? "#334155" : color + "55"}`,
        color: disabled ? "#334155" : color,
        borderRadius: "4px",
        fontSize: "0.6rem",
        letterSpacing: "0.1em",
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "'Courier New', monospace",
        display: "flex", alignItems: "center", gap: "0.3rem",
        transition: "all 0.15s",
      }}
    >
      {icon} {label}
    </button>
  );
}
