import os, subprocess, tempfile, shutil, json
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from mutagen.mp3 import MP3

app = Flask(__name__)
CORS(app)

@app.route("/", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "ai-video-studio-v11"})

# ─── Utility: durata file audio ───────────────────────────────────────────────
def get_duration(file_path):
    """Ritorna la durata in secondi. Prova mutagen (veloce), fallback su ffprobe."""
    if file_path.endswith('.mp3'):
        try:
            return MP3(file_path).info.length
        except Exception:
            pass
    try:
        cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration",
               "-of", "default=noprint_wrappers=1:nokey=1", file_path]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        val = res.stdout.strip()
        if val and val != 'N/A':
            return float(val)
    except Exception:
        pass
    return 5.0  # fallback sicuro

# ─── Motore FFmpeg ────────────────────────────────────────────────────────────
def _build_cmd(template, paths, media_settings, voice_path, music_path,
               voice_vol, music_vol, video_text, output):
    n = len(paths)
    if n == 0:
        return []

    img_dur = 3.0  # durata immagini statiche di default
    cmd = ["ffmpeg", "-y"]

    target_dur = 0.0

    # ── Input media (con supporto Trim per i video) ───────────────────────────
    for i, p in enumerate(paths):
        setting = media_settings[i] if i < len(media_settings) else {}
        ext = os.path.splitext(p)[1].lower()
        is_video = setting.get("type", "image") == "video" or ext in [".mp4", ".mov", ".webm", ".avi", ".mkv"]
        trim_start = float(setting.get("trimStart", 0))
        trim_end = setting.get("trimEnd")

        item_dur = 0.0
        if is_video:
            if trim_end is not None:
                duration = float(trim_end) - trim_start
                cmd += ["-ss", str(trim_start), "-t", str(duration), "-i", p]
                item_dur = duration
            else:
                cmd += ["-ss", str(trim_start), "-i", p]
                item_dur = max(0.0, get_duration(p) - trim_start)
        else:
            cmd += ["-loop", "1", "-t", str(img_dur), "-i", p]
            item_dur = img_dur

        if template == "pip":
            if i == 0: target_dur = item_dur
        else:
            target_dur += item_dur

    if target_dur <= 0:
        target_dur = 5.0

    # ── Input audio ───────────────────────────────────────────────────────────
    audio_idx_voice = -1
    audio_idx_music = -1
    if voice_path:
        cmd += ["-i", voice_path]
        audio_idx_voice = n
    if music_path:
        cmd += ["-i", music_path]
        audio_idx_music = n + (1 if voice_path else 0)

    # ── Risoluzione output ────────────────────────────────────────────────────
    w, h = (480, 854) if template == "vertical" else (854, 480)

    # ── Filtri video per ogni clip ────────────────────────────────────────────
    filters = []
    for i in range(n):
        if template in ["social", "vertical", "panning", "fade"]:
            bg = f"[{i}:v]scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},boxblur=20:10[bg{i}]"
            fg = f"[{i}:v]scale={w}:{h}:force_original_aspect_ratio=decrease[fg{i}]"

            if template in ["social", "vertical"]:
                move = i % 4
                if move == 0:
                    x_expr = f"if(lte(t,1), -{w}+(t*{w})+(main_w-w)/2, (main_w-w)/2)"
                    ov = f"[bg{i}][fg{i}]overlay=x='{x_expr}':y=(main_h-h)/2,setsar=1[v{i}]"
                elif move == 1:
                    y_expr = f"if(lte(t,1), -{h}+(t*{h})+(main_h-h)/2, (main_h-h)/2)"
                    ov = f"[bg{i}][fg{i}]overlay=x=(main_w-w)/2:y='{y_expr}',setsar=1[v{i}]"
                elif move == 2:
                    rot = f"[fg{i}]rotate=a='if(lte(t,1), 2*PI*(1-t), 0)':c=black@0[rot{i}]"
                    bg += ";" + rot
                    ov = f"[bg{i}][rot{i}]overlay=(main_w-w)/2:(main_h-h)/2,setsar=1[v{i}]"
                else:
                    x_expr = f"if(lte(t,1), {w}-(t*{w})+(main_w-w)/2, (main_w-w)/2)"
                    ov = f"[bg{i}][fg{i}]overlay=x='{x_expr}':y=(main_h-h)/2,setsar=1[v{i}]"
                filters.append(f"{bg};{fg};{ov}")
            else:
                ov = f"[bg{i}][fg{i}]overlay=(main_w-w)/2:(main_h-h)/2,setsar=1[v{i}]"
                filters.append(f"{bg};{fg};{ov}")
        else:
            filters.append(
                f"[{i}:v]scale={w}:{h}:force_original_aspect_ratio=increase,"
                f"crop={w}:{h},format=yuv420p,setsar=1,fps=30[v{i}]"
            )

    # ── Concatenazione video ──────────────────────────────────────────────────
    if template == "pip":
        if n > 1:
            filters.append(f"[v0][v1]overlay=main_w-overlay_w-20:main_h-overlay_h-20[outv_pre]")
        else:
            filters.append("[v0]copy[outv_pre]")
    else:
        concat_in = "".join(f"[v{i}]" for i in range(n))
        filters.append(f"{concat_in}concat=n={n}:v=1:a=0[outv_pre]")

    # ── Testo in sovrimpressione (opzionale) ──────────────────────────────────
    if video_text:
        escaped = video_text.replace("'", "\\'").replace(":", "\\:")
        filters.append(
            f"[outv_pre]drawtext=text='{escaped}':"
            f"fontcolor=white:fontsize=24:box=1:boxcolor=black@0.5:"
            f"boxborderw=5:x=(w-text_w)/2:y=h-th-40[vout]"
        )
    else:
        filters.append("[outv_pre]copy[vout]")

    # ── Mixer audio ───────────────────────────────────────────────────────────
    # apad estende la musica con silenzio fino alla fine del video (compatibile
    # con tutte le versioni di FFmpeg, a differenza di -stream_loop)
    amix = ""
    if voice_path and music_path:
        amix = (f"[{audio_idx_voice}:a]volume={voice_vol}[a1];"
                f"[{audio_idx_music}:a]volume={music_vol},apad[a2];"
                f"[a1][a2]amix=inputs=2[aout]")
    elif voice_path:
        amix = f"[{audio_idx_voice}:a]volume={voice_vol}[aout]"
    elif music_path:
        amix = f"[{audio_idx_music}:a]volume={music_vol},apad[aout]"

    # ── Assemblaggio filter_complex ───────────────────────────────────────────
    filter_complex = ";".join(filters)
    if amix:
        filter_complex += ";" + amix

    cmd += ["-filter_complex", filter_complex, "-map", "[vout]"]
    if amix:
        cmd += ["-map", "[aout]"]

    # Sostituito -shortest con -t target_dur per tagliare con precisione millimetrica
    # evitando i blocchi infiniti causati dal mix di apad e shortest nelle vecchie versioni
    cmd += ["-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
            "-movflags", "+faststart", "-t", str(target_dur), output]
    return cmd

# ─── Endpoint di rendering ────────────────────────────────────────────────────
@app.route("/render", methods=["POST"])
def render():
    tmp = tempfile.mkdtemp()
    try:
        project_name = request.form.get("projectName", "Project")
        template = request.form.get("template", "social")
        voice_vol = float(request.form.get("voiceVolume", 1.0))
        music_vol = float(request.form.get("musicVolume", 0.2))
        video_text = request.form.get("videoText", "")

        # Trim settings dal frontend
        media_settings = json.loads(request.form.get("mediaSettings", "[]"))

        media_files = request.files.getlist("media")
        voice_file = request.files.get("voice")
        music_file = request.files.get("music")

        if not media_files:
            return jsonify({"error": "Nessun file media"}), 400

        # Salva media su disco temporaneo
        paths = []
        for i, f in enumerate(media_files):
            ext = f.filename.rsplit('.', 1)[-1] if '.' in f.filename else 'jpg'
            p = os.path.join(tmp, f"media_{i:03d}.{ext}")
            f.save(p)
            paths.append(p)

        voice_path = None
        if voice_file:
            voice_path = os.path.join(tmp, "voice.mp3")
            voice_file.save(voice_path)

        music_path = None
        if music_file:
            music_path = os.path.join(tmp, "music.mp3")
            music_file.save(music_path)

        output = os.path.join(tmp, f"{project_name.replace(' ', '_')}.mp4")
        cmd = _build_cmd(template, paths, media_settings, voice_path, music_path,
                         voice_vol, music_vol, video_text, output)

        print(f"FFMPEG CMD: {' '.join(cmd)}", flush=True)
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)

        if result.returncode != 0:
            print(f"FFMPEG STDERR: {result.stderr[-500:]}", flush=True)
            return jsonify({"error": "FFmpeg failed", "detail": result.stderr[-500:]}), 500

        return send_file(output, mimetype="video/mp4", as_attachment=True,
                         download_name=f"{project_name.replace(' ', '_')}.mp4")

    except subprocess.TimeoutExpired:
        return jsonify({"error": "Timeout >10min"}), 504
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=False)
