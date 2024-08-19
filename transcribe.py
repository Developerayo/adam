import sys
import whisper

model = whisper.load_model("base")

# Get the audio file path from command line argument
audio_file = sys.argv[1]

# Transcribe the audio
result = model.transcribe(audio_file)

# Print the transcription
print(result["text"])