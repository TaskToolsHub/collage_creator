import os, subprocess, tempfile, shutil, json
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import mutagen

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

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        if result.returncode != 0:
            return jsonify({"error": "FFmpeg failed", "detail": result.stderr[-500:]}), 500

        return send_file(output, mimetype="video/mp4", as_attachment=True, download_name=f"{project_name.replace(' ','_')}.mp4")
    except subprocess.TimeoutExpired:
        return jsonify({"error": "Timeout >10min - Il video è troppo lungo per il server gratuito"}), 504
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

def get_duration(file_path):
    cmd = ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file_path]
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        dur = res.stdout.strip()
        print(f"DEBUG: ffprobe extracted duration '{dur}' for file {file_path}", flush=True)
        if dur and dur != 'N/A':
            return float(dur)
    except Exception as e:
        print(f"DEBUG: ffprobe failed for {file_path}: {e}", flush=True)
    return 0.0

def _build_cmd(template, paths, voice_path, music_path, voice_vol, music_vol, output):
    cmd = ["ffmpeg", "-y"]
    n = len(paths)
    
    total_audio_dur = 0.0
    if voice_path:
        dur = get_duration(voice_path)
        print(f"DEBUG: Voice duration: {dur}", flush=True)
        total_audio_dur = max(total_audio_dur, dur)
    if music_path:
        dur = get_duration(music_path)
        print(f"DEBUG: Music duration: {dur}", flush=True)
        total_audio_dur = max(total_audio_dur, dur)
        
    print(f"DEBUG: Total audio duration calculated: {total_audio_dur}", flush=True)
    img_dur = 3.0
    if total_audio_dur > 0 and n > 0:
        img_dur = (total_audio_dur / n) + 0.1
        img_dur = max(2.0, img_dur) 
    
    print(f"DEBUG: Assigned image duration: {img_dur}", flush=True)
        
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
        cmd += ["-stream_loop", "-1", "-i", music_path]
        audio_idx_music = n + (1 if voice_path else 0)

    w, h = (480, 854) if template == "vertical" else (854, 480)
    
    filters = []
    for i in range(n):
        d_frames = int(img_dur * 30)
        if template == "fade":
            # Zoom-out effect: start slightly zoomed in and move out
            base = f"scale={w*2}:{h*2}:force_original_aspect_ratio=increase,crop={w*2}:{h*2}"
            zoom = f"zoompan=z='1.1-0.0005*on':d={d_frames}:s={w}x{h}:fps=30"
            fade = f"fade=t=in:st=0:d=1,fade=t=out:st={img_dur-1}:d=1"
            filters.append(f"[{i}:v]{base},{zoom},{fade},format=yuv420p,setsar=1,fps=30[v{i}]")
        elif template == "panning":
            # Alternating pan effects
            base = f"scale={w*2}:{h*2}:force_original_aspect_ratio=increase,crop={w*2}:{h*2}"
            if i % 4 == 0: # Left to Right
                pan = f"zoompan=z=1.2:x='(on/{d_frames})*(iw-iw/zoom)':y='ih/2-ih/zoom/2':d={d_frames}:s={w}x{h}:fps=30"
            elif i % 4 == 1: # Top to Bottom
                pan = f"zoompan=z=1.2:x='iw/2-iw/zoom/2':y='(on/{d_frames})*(ih-ih/zoom)':d={d_frames}:s={w}x{h}:fps=30"
            elif i % 4 == 2: # Right to Left
                pan = f"zoompan=z=1.2:x='(1-on/{d_frames})*(iw-iw/zoom)':y='ih/2-ih/zoom/2':d={d_frames}:s={w}x{h}:fps=30"
            else: # Bottom to Top
                pan = f"zoompan=z=1.2:x='iw/2-iw/zoom/2':y='(1-on/{d_frames})*(ih-ih/zoom)':d={d_frames}:s={w}x{h}:fps=30"
            fade = f"fade=t=in:st=0:d=1,fade=t=out:st={img_dur-1}:d=1"
            filters.append(f"[{i}:v]{base},{pan},{fade},format=yuv420p,setsar=1,fps=30[v{i}]")
        elif template == "slideshow" or template == "vertical":
            base = f"scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h}"
            fade = f"fade=t=in:st=0:d=1,fade=t=out:st={img_dur-1}:d=1"
            filters.append(f"[{i}:v]{base},{fade},format=yuv420p,setsar=1,fps=30[v{i}]")

    if template == "pip":
        if n > 1:
            filters.append(f"[v0][pip1]overlay=main_w-overlay_w-20:main_h-overlay_h-20[outv]")
        else:
            filters.append(f"[v0]copy[outv]")
    else:
        concat_in = "".join(f"[v{i}]" for i in range(n))
        filters.append(f"{concat_in}concat=n={n}:v=1:a=0[outv]")
        
    graph = ";".join(filters)

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
        else:
            audio_filter += f"{amap[0]}copy[outa]"
            
        graph += ";" + audio_filter
        cmd += ["-filter_complex", graph, "-map", "[outv]", "-map", "[outa]", "-shortest"]
    else:
        cmd += ["-filter_complex", graph, "-map", "[outv]"]

    cmd += ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "28", "-movflags", "+faststart", output]
    return cmd

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=False)
