import librosa
import soundfile as sf

# Load audio file
audio_file = "audio/test.wav"
speech_array, original_sampling_rate = librosa.load(audio_file, sr=None)

# Resample to 16kHz if needed
if original_sampling_rate != 16000:
    speech_array = librosa.resample(speech_array, orig_sr=original_sampling_rate, target_sr=16000)

# Save the resampled audio
sf.write("audio/new-test.wav", speech_array, 16000)