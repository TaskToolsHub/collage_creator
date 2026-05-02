import os, subprocess, tempfile, shutil, json
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route("/", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "collage-creator-v4"})

@app.route("/render", methods=["POST"])
def render():
    tmp = tempfile.mkdtemp()
    try:
        template = request.form.get("template", "fade")
        project_name = request.form.get("projectName", "collage")
        voice_vol = float(request.form.get("voiceVolume", 1.0))
        music_vol = float(request.form.get("musicVolume", 0.2))
        
        media_files = request.files.getlist("media")
        voice_file = request.files.get("voice")
        music_file = request.files.get("music")

        if not media_files:
            return jsonify({"error": "Nessun file media"}), 400

        paths = []
        for i, f in enumerate(media_files):
            ext = os.path.splitext(f.filename)[1] or ".jpg"
            p = os.path.join(tmp, f"media_{i:03d}{ext}")
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

        output = os.path.join(tmp, f"{project_name.replace(' ','_')}.mp4")
        cmd = _build_cmd(template, paths, voice_path, music_path, voice_vol, music_vol, output)
        print(f"FFmpeg V4: {' '.join(cmd)}")

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if result.returncode != 0:
            return jsonify({"error": "FFmpeg failed", "detail": result.stderr[-500:]}), 500

        return send_file(output, mimetype="video/mp4", as_attachment=True, download_name=f"{project_name.replace(' ','_')}.mp4")
    except subprocess.TimeoutExpired:
        return jsonify({"error": "Timeout >5min"}), 504
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

def get_duration(file_path):
    cmd = ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_format", "-show_streams", file_path]
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        data = json.loads(res.stdout)
        return float(data['format']['duration'])
    except Exception:
        return 0.0

def _build_cmd(template, paths, voice_path, music_path, voice_vol, music_vol, output):
    cmd = ["ffmpeg", "-y"]
    n = len(paths)
    
    total_audio_dur = 0.0
    if voice_path:
        total_audio_dur = max(total_audio_dur, get_duration(voice_path))
    if music_path:
        total_audio_dur = max(total_audio_dur, get_duration(music_path))
        
    img_dur = 3.0
    if total_audio_dur > 0 and n > 0:
        img_dur = (total_audio_dur / n) + 0.1
        img_dur = max(2.0, img_dur) 
        
    for p in paths:
        ext = os.path.splitext(p)[1].lower()
        if ext in (".jpg", ".jpeg", ".png", ".webp", ".bmp"):
            cmd += ["-loop", "1", "-t", str(img_dur), "-i", p]
        else:
            cmd += ["-t", str(img_dur), "-i", p]
            
    audio_idx_voice = -1
    audio_idx_music = -1
    if voice_path:
        cmd += ["-i", voice_path]
        audio_idx_voice = n
    if music_path:
        cmd += ["-i", music_path]
        audio_idx_music = n + (1 if voice_path else 0)

    w, h = (720, 1280) if template == "vertical" else (1280, 720)
    
    filters = []
    for i in range(n):
        if template == "fade":
            base = f"scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:black"
            zoom = f"zoompan=z='min(zoom+0.001,1.5)':d={int(img_dur*30)}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={w}x{h}:fps=30"
            filters.append(f"[{i}:v]{base},{zoom},format=yuv420p,setsar=1[v{i}]")
        elif template == "slideshow":
            base = f"scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:black"
            fade = f"fade=t=in:st=0:d=1,fade=t=out:st={img_dur-1}:d=1"
            filters.append(f"[{i}:v]{base},{fade},format=yuv420p,setsar=1,fps=30[v{i}]")
        elif template == "pip" and i > 0:
            filters.append(f"[{i}:v]scale=320:-1,format=yuv420p,setsar=1,fps=30[pip{i}]")
        else:
            filters.append(f"[{i}:v]scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p,setsar=1,fps=30[v{i}]")

    if template == "pip":
        if n > 1:
            filters.append(f"[v0][pip1]overlay=main_w-overlay_w-20:main_h-overlay_h-20[outv]")
        else:
            filters.append(f"[v0]copy[outv]")
    else:
        concat_in = "".join(f"[v{i}]" for i in range(n))
        filters.append(f"{concat_in}concat=n={n}:v=1:a=0[outv]")
        
    cmd += ["-filter_complex", ";".join(filters), "-map", "[outv]"]

    if voice_path or music_path:
        audio_filter = ""
        inputs = 0
        amap = []
        if voice_path:
            audio_filter += f"[{audio_idx_voice}:a]volume={voice_vol}[aV];"
            amap.append("[aV]")
            inputs += 1
        if music_path:
            audio_filter += f"[{audio_idx_music}:a]volume={music_vol}[aM];"
            amap.append("[aM]")
            inputs += 1
            
        if inputs == 2:
            audio_filter += f"[aV][aM]amix=inputs=2:duration=first:dropout_transition=2[outa]"
            cmd += ["-filter_complex", audio_filter, "-map", "[outa]"]
        else:
            audio_filter += f"{amap[0]}copy[outa]"
            cmd += ["-filter_complex", audio_filter, "-map", "[outa]"]
        cmd += ["-shortest"]

    cmd += ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "28", "-movflags", "+faststart", output]
    return cmd

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=False)
