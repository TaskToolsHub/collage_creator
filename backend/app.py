import os, subprocess, tempfile, shutil, uuid
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route("/", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "collage-creator-backend"})

@app.route("/render", methods=["POST"])
def render():
    tmp = tempfile.mkdtemp()
    try:
        template = request.form.get("template", "sequence")
        project_name = request.form.get("projectName", "collage")
        media_files = request.files.getlist("media")
        audio_file = request.files.get("audio")

        if not media_files:
            return jsonify({"error": "Nessun file media ricevuto"}), 400

        # Save uploaded files
        paths = []
        for i, f in enumerate(media_files):
            ext = os.path.splitext(f.filename)[1] or ".jpg"
            p = os.path.join(tmp, f"media_{i:03d}{ext}")
            f.save(p)
            paths.append(p)

        audio_path = None
        if audio_file:
            ext = os.path.splitext(audio_file.filename)[1] or ".mp3"
            audio_path = os.path.join(tmp, f"audio{ext}")
            audio_file.save(audio_path)

        output = os.path.join(tmp, f"{project_name.replace(' ','_')}.mp4")

        # Build FFmpeg command based on template
        cmd = _build_cmd(template, paths, audio_path, output)
        print(f"FFmpeg cmd: {' '.join(cmd)}")

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if result.returncode != 0:
            print(f"FFmpeg stderr: {result.stderr}")
            return jsonify({"error": "FFmpeg failed", "detail": result.stderr[-500:]}), 500

        if not os.path.exists(output):
            return jsonify({"error": "Output file not created"}), 500

        return send_file(output, mimetype="video/mp4", as_attachment=True,
                         download_name=f"{project_name.replace(' ','_')}.mp4")
    except subprocess.TimeoutExpired:
        return jsonify({"error": "Rendering timeout (>5min)"}), 504
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def _build_cmd(template, paths, audio_path, output):
    if template == "grid2x2":
        return _build_grid2x2(paths, audio_path, output)
    elif template == "splitv":
        return _build_split(paths, audio_path, output, "hstack")
    elif template == "splith":
        return _build_split(paths, audio_path, output, "vstack")
    elif template == "slideshow":
        return _build_slideshow(paths, audio_path, output)
    else:
        return _build_sequence(paths, audio_path, output)


def _build_sequence(paths, audio_path, output):
    """Linear sequence with crossfade between clips/images."""
    cmd = ["ffmpeg", "-y"]
    filter_parts = []
    n = len(paths)

    for i, p in enumerate(paths):
        ext = os.path.splitext(p)[1].lower()
        if ext in (".jpg", ".jpeg", ".png", ".webp", ".bmp"):
            cmd += ["-loop", "1", "-t", "3", "-i", p]
        else:
            cmd += ["-t", "15", "-i", p]

    # Scale all to 1280x720
    for i in range(n):
        filter_parts.append(f"[{i}:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v{i}]")

    # Concat
    concat_in = "".join(f"[v{i}]" for i in range(n))
    filter_parts.append(f"{concat_in}concat=n={n}:v=1:a=0[outv]")
    cmd += ["-filter_complex", ";".join(filter_parts), "-map", "[outv]"]

    if audio_path:
        cmd += ["-i", audio_path, "-map", f"{n}:a", "-shortest"]

    cmd += ["-c:v", "libx264", "-crf", "23", "-preset", "fast", "-pix_fmt", "yuv420p", output]
    return cmd


def _build_slideshow(paths, audio_path, output):
    """Ken Burns style slideshow with zoompan."""
    cmd = ["ffmpeg", "-y"]
    filter_parts = []
    n = len(paths)

    for i, p in enumerate(paths):
        cmd += ["-loop", "1", "-t", "4", "-i", p]

    for i in range(n):
        filter_parts.append(f"[{i}:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,zoompan=z='min(zoom+0.001,1.2)':d=120:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1280x720,fps=30[v{i}]")

    concat_in = "".join(f"[v{i}]" for i in range(n))
    filter_parts.append(f"{concat_in}concat=n={n}:v=1:a=0[outv]")
    cmd += ["-filter_complex", ";".join(filter_parts), "-map", "[outv]"]

    if audio_path:
        cmd += ["-i", audio_path, "-map", f"{n}:a", "-shortest"]

    cmd += ["-c:v", "libx264", "-crf", "23", "-preset", "fast", "-pix_fmt", "yuv420p", output]
    return cmd


def _build_grid2x2(paths, audio_path, output):
    """2x2 grid layout with up to 4 media files."""
    cmd = ["ffmpeg", "-y"]
    use = paths[:4]
    while len(use) < 4:
        use.append(use[-1])
    n = len(use)

    for p in use:
        ext = os.path.splitext(p)[1].lower()
        if ext in (".jpg", ".jpeg", ".png", ".webp", ".bmp"):
            cmd += ["-loop", "1", "-t", "5", "-i", p]
        else:
            cmd += ["-t", "15", "-i", p]

    filt = ""
    for i in range(4):
        filt += f"[{i}:v]scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v{i}];"
    filt += "[v0][v1]hstack[top];[v2][v3]hstack[bot];[top][bot]vstack[outv]"
    cmd += ["-filter_complex", filt, "-map", "[outv]"]

    if audio_path:
        cmd += ["-i", audio_path, "-map", f"{n}:a", "-shortest"]

    cmd += ["-c:v", "libx264", "-crf", "23", "-preset", "fast", "-pix_fmt", "yuv420p", output]
    return cmd


def _build_split(paths, audio_path, output, stack_type):
    """Split screen: hstack (side by side) or vstack (top/bottom)."""
    cmd = ["ffmpeg", "-y"]
    use = paths[:2]
    while len(use) < 2:
        use.append(use[-1])
    n = len(use)

    w, h = (640, 720) if stack_type == "hstack" else (1280, 360)
    for p in use:
        ext = os.path.splitext(p)[1].lower()
        if ext in (".jpg", ".jpeg", ".png", ".webp", ".bmp"):
            cmd += ["-loop", "1", "-t", "5", "-i", p]
        else:
            cmd += ["-t", "15", "-i", p]

    filt = ""
    for i in range(2):
        filt += f"[{i}:v]scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v{i}];"
    filt += f"[v0][v1]{stack_type}[outv]"
    cmd += ["-filter_complex", filt, "-map", "[outv]"]

    if audio_path:
        cmd += ["-i", audio_path, "-map", f"{n}:a", "-shortest"]

    cmd += ["-c:v", "libx264", "-crf", "23", "-preset", "fast", "-pix_fmt", "yuv420p", output]
    return cmd


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
