"""
COLLAGE CREATOR — Backend Python
TaskToolsHub · MIT License
─────────────────────────────────────────
Stack: Flask + FFmpeg + Firebase Admin SDK
Deploy: Render.com (secondo servizio, sleep mode)
─────────────────────────────────────────
"""

import os
import json
import uuid
import subprocess
import tempfile
import urllib.request
from pathlib import Path
from flask import Flask, request, jsonify
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, storage as fb_storage

app = Flask(__name__)
CORS(app)

# ── Firebase Admin Init ────────────────────────────────────
# Metti il tuo service account JSON come variabile d'ambiente FIREBASE_SERVICE_ACCOUNT
_sa = json.loads(os.environ.get("FIREBASE_SERVICE_ACCOUNT", "{}"))
if _sa:
    cred = credentials.Certificate(_sa)
    firebase_admin.initialize_app(cred, {
        "storageBucket": os.environ.get("FIREBASE_STORAGE_BUCKET", "task-collage-creator.firebasestorage.app")
    })

BUCKET = fb_storage.bucket() if _sa else None

# ── Template definitions ───────────────────────────────────
TEMPLATES = {
    "sequence":  _build_sequence,
    "slideshow": _build_slideshow,
    "grid2x2":   _build_grid2x2,
    "splitv":    _build_splitv,
    "splith":    _build_splith,
}

# ── Health check ───────────────────────────────────────────
@app.route("/", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "collage-creator-backend"})

# ── MAIN RENDER ENDPOINT ───────────────────────────────────
@app.route("/render", methods=["POST"])
def render():
    payload = request.get_json()
    if not payload:
        return jsonify({"error": "No payload"}), 400

    project_id   = payload.get("projectId", str(uuid.uuid4()))
    uid          = payload.get("uid", "anon")
    template     = payload.get("template", "sequence")
    media_list   = payload.get("media", [])
    audio        = payload.get("audio")
    output_opts  = payload.get("output", {})

    if not media_list:
        return jsonify({"error": "No media provided"}), 400

    resolution = output_opts.get("resolution", "1080x1920")
    fps        = output_opts.get("fps", 30)
    w, h       = map(int, resolution.split("x"))

    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir = Path(tmpdir)

        # 1. Download all media
        local_media = []
        for i, m in enumerate(media_list):
            ext  = m["url"].split("?")[0].split(".")[-1].split("/")[-1] or "mp4"
            dest = tmpdir / f"media_{i:02d}.{ext}"
            try:
                urllib.request.urlretrieve(m["url"], dest)
                local_media.append({
                    "path":  str(dest),
                    "type":  m.get("type", "image/jpeg"),
                    "index": i,
                })
            except Exception as e:
                return jsonify({"error": f"Download failed for media {i}: {e}"}), 500

        # 2. Download audio
        audio_path = None
        if audio and audio.get("url"):
            audio_path = str(tmpdir / "audio.mp3")
            urllib.request.urlretrieve(audio["url"], audio_path)

        # 3. Build FFmpeg command based on template
        output_path = str(tmpdir / "output.mp4")
        builder = TEMPLATES.get(template, _build_sequence)
        cmd = builder(local_media, audio_path, output_path, w, h, fps)

        # 4. Run FFmpeg
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if result.returncode != 0:
            return jsonify({
                "error": "FFmpeg failed",
                "stderr": result.stderr[-2000:]
            }), 500

        # 5. Upload to Firebase Storage (auto-delete after 7 days via lifecycle rule)
        storage_path = f"renders/{uid}/{project_id}/collage_{uuid.uuid4().hex[:8]}.mp4"
        if BUCKET:
            blob = BUCKET.blob(storage_path)
            blob.upload_from_filename(output_path, content_type="video/mp4")
            blob.make_public()
            url = blob.public_url
        else:
            # Dev fallback — return local path info
            url = f"file://{output_path}"
            storage_path = output_path

        return jsonify({
            "url":         url,
            "storagePath": storage_path,
            "template":    template,
            "mediaCount":  len(local_media),
        })


# ─────────────────────────────────────────────────────────
# FFmpeg template builders
# Ogni funzione ritorna il comando FFmpeg completo come lista
# ─────────────────────────────────────────────────────────

def _photo_duration(is_video):
    """Foto: 3 secondi fissi. Video: usa durata naturale."""
    return None if is_video else 3

def _build_sequence(media, audio_path, output, w, h, fps):
    """
    Template 1 — Sequenza lineare con dissolvenza
    Foto: 3 sec ciascuna · Video: durata naturale
    """
    inputs = []
    filter_parts = []
    streams = []

    for i, m in enumerate(media):
        is_video = m["type"].startswith("video")
        if is_video:
            inputs += ["-i", m["path"]]
        else:
            inputs += ["-loop", "1", "-t", "3", "-i", m["path"]]

        # Scale + pad to target resolution
        filter_parts.append(
            f"[{i}:v]scale={w}:{h}:force_original_aspect_ratio=decrease,"
            f"pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:black,"
            f"setsar=1,fps={fps}[v{i}]"
        )
        streams.append(f"[v{i}]")

    n = len(media)
    concat_filter = "".join(streams) + f"concat=n={n}:v=1:a=0[vout]"
    filter_complex = ";".join(filter_parts) + ";" + concat_filter

    cmd = ["ffmpeg", "-y"] + inputs
    if audio_path:
        cmd += ["-i", audio_path]
    cmd += [
        "-filter_complex", filter_complex,
        "-map", "[vout]",
    ]
    if audio_path:
        cmd += ["-map", f"{n}:a", "-shortest"]
    cmd += ["-c:v", "libx264", "-crf", "23", "-preset", "fast",
            "-c:a", "aac", "-b:a", "128k", output]
    return cmd


def _build_slideshow(media, audio_path, output, w, h, fps):
    """
    Template 2 — Slideshow con Ken Burns zoom
    Solo foto, 4 secondi con leggero zoom in
    """
    inputs = []
    filter_parts = []
    streams = []

    for i, m in enumerate(media):
        inputs += ["-loop", "1", "-t", "4", "-i", m["path"]]
        zoom_filter = (
            f"[{i}:v]scale={w*2}:{h*2}:force_original_aspect_ratio=increase,"
            f"zoompan=z='min(zoom+0.0015,1.5)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':"
            f"d={fps*4}:s={w}x{h}:fps={fps},"
            f"setsar=1[v{i}]"
        )
        filter_parts.append(zoom_filter)
        streams.append(f"[v{i}]")

    n = len(media)
    concat = "".join(streams) + f"concat=n={n}:v=1:a=0[vout]"
    filter_complex = ";".join(filter_parts) + ";" + concat

    cmd = ["ffmpeg", "-y"] + inputs
    if audio_path:
        cmd += ["-i", audio_path]
    cmd += ["-filter_complex", filter_complex, "-map", "[vout]"]
    if audio_path:
        cmd += ["-map", f"{n}:a", "-shortest"]
    cmd += ["-c:v", "libx264", "-crf", "22", "-preset", "fast",
            "-c:a", "aac", "-b:a", "128k", output]
    return cmd


def _build_grid2x2(media, audio_path, output, w, h, fps):
    """
    Template 3 — Griglia 2×2 simultanea
    Usa i primi 4 media
    """
    clips = media[:4]
    inputs = []
    scale_parts = []
    hw, hh = w // 2, h // 2

    for i, m in enumerate(clips):
        is_video = m["type"].startswith("video")
        if is_video:
            inputs += ["-i", m["path"]]
        else:
            inputs += ["-loop", "1", "-t", "5", "-i", m["path"]]
        scale_parts.append(
            f"[{i}:v]scale={hw}:{hh}:force_original_aspect_ratio=decrease,"
            f"pad={hw}:{hh}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps={fps}[s{i}]"
        )

    # Fill missing slots with black
    while len(clips) < 4:
        scale_parts.append(f"color=black:size={hw}x{hh}:rate={fps}[s{len(clips)}]")
        clips.append(None)

    layout = f"[s0][s1]hstack[top];[s2][s3]hstack[bot];[top][bot]vstack[vout]"
    filter_complex = ";".join(scale_parts) + ";" + layout

    cmd = ["ffmpeg", "-y"] + inputs
    if audio_path:
        cmd += ["-i", audio_path]
    cmd += ["-filter_complex", filter_complex, "-map", "[vout]", "-t", "10"]
    if audio_path:
        cmd += ["-map", f"{len(inputs)//2}:a", "-shortest"]
    cmd += ["-c:v", "libx264", "-crf", "23", "-preset", "fast",
            "-c:a", "aac", output]
    return cmd


def _build_splitv(media, audio_path, output, w, h, fps):
    """Template 4 — Split verticale (2 clip affiancate)"""
    clips = media[:2]
    inputs = []
    half_w = w // 2

    for i, m in enumerate(clips):
        is_video = m["type"].startswith("video")
        if is_video:
            inputs += ["-i", m["path"]]
        else:
            inputs += ["-loop", "1", "-t", "5", "-i", m["path"]]

    scale = (
        f"[0:v]scale={half_w}:{h}:force_original_aspect_ratio=decrease,"
        f"pad={half_w}:{h}:(ow-iw)/2:(oh-ih)/2:black,fps={fps}[l];"
        f"[1:v]scale={half_w}:{h}:force_original_aspect_ratio=decrease,"
        f"pad={half_w}:{h}:(ow-iw)/2:(oh-ih)/2:black,fps={fps}[r];"
        f"[l][r]hstack[vout]"
    )
    cmd = ["ffmpeg", "-y"] + inputs
    if audio_path:
        cmd += ["-i", audio_path]
    cmd += ["-filter_complex", scale, "-map", "[vout]", "-t", "10"]
    if audio_path:
        cmd += ["-map", f"{len(clips)}:a", "-shortest"]
    cmd += ["-c:v", "libx264", "-crf", "23", "-preset", "fast", output]
    return cmd


def _build_splith(media, audio_path, output, w, h, fps):
    """Template 5 — Split orizzontale (sopra/sotto)"""
    clips = media[:2]
    inputs = []
    half_h = h // 2

    for i, m in enumerate(clips):
        is_video = m["type"].startswith("video")
        if is_video:
            inputs += ["-i", m["path"]]
        else:
            inputs += ["-loop", "1", "-t", "5", "-i", m["path"]]

    scale = (
        f"[0:v]scale={w}:{half_h}:force_original_aspect_ratio=decrease,"
        f"pad={w}:{half_h}:(ow-iw)/2:(oh-ih)/2:black,fps={fps}[t];"
        f"[1:v]scale={w}:{half_h}:force_original_aspect_ratio=decrease,"
        f"pad={w}:{half_h}:(ow-iw)/2:(oh-ih)/2:black,fps={fps}[b];"
        f"[t][b]vstack[vout]"
    )
    cmd = ["ffmpeg", "-y"] + inputs
    if audio_path:
        cmd += ["-i", audio_path]
    cmd += ["-filter_complex", scale, "-map", "[vout]", "-t", "10"]
    if audio_path:
        cmd += ["-map", f"{len(clips)}:a", "-shortest"]
    cmd += ["-c:v", "libx264", "-crf", "23", "-preset", "fast", output]
    return cmd


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
