#!/usr/bin/env python3
"""
Continuous wake-word listener using openWakeWord.
Prints "WAKE" to stdout when the configured model fires.
Accepts optional args: <model_name_or_path> <threshold> <mic_device>
  model_name_or_path  — built-in name (e.g. hey_mycroft_v1) or path to .onnx file
  threshold           — detection confidence 0.0–1.0 (default 0.5)
  mic_device          — ALSA device string or "default"
"""
import sys
import os
import numpy as np

def main():
    model_name = sys.argv[1] if len(sys.argv) > 1 else "hey_mycroft_v1"
    threshold = float(sys.argv[2]) if len(sys.argv) > 2 else 0.5
    mic_device = sys.argv[3] if len(sys.argv) > 3 else "default"

    from openwakeword.model import Model

    if os.path.isfile(model_name):
        model = Model(wakeword_models=[model_name], inference_framework="onnx")
    else:
        model = Model(wakeword_models=[model_name], inference_framework="onnx")

    import pyaudio
    CHUNK = 1280  # 80ms at 16kHz — openWakeWord's expected frame size
    RATE = 16000

    p = pyaudio.PyAudio()

    device_index = None
    if mic_device != "default":
        for i in range(p.get_device_count()):
            info = p.get_device_info_by_index(i)
            if mic_device in info["name"] and info["maxInputChannels"] > 0:
                device_index = i
                break

    stream = p.open(
        format=pyaudio.paInt16,
        channels=1,
        rate=RATE,
        input=True,
        input_device_index=device_index,
        frames_per_buffer=CHUNK
    )

    sys.stderr.write("READY\n")
    sys.stderr.flush()

    COOLDOWN_FRAMES = 20  # ~1.6s silence after a detection
    cooldown = 0

    while True:
        audio = stream.read(CHUNK, exception_on_overflow=False)
        if cooldown > 0:
            cooldown -= 1
            continue
        audio_np = np.frombuffer(audio, dtype=np.int16)
        prediction = model.predict(audio_np)
        for score in prediction.values():
            if score >= threshold:
                sys.stdout.write("WAKE\n")
                sys.stdout.flush()
                cooldown = COOLDOWN_FRAMES
                break

if __name__ == "__main__":
    main()
