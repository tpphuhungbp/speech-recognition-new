import asyncio
import websockets
from transformers import pipeline
from pydub import AudioSegment
from io import BytesIO
import torch
import json

# PhoWhisper model for speech-to-text
pipe = pipeline("automatic-speech-recognition", model="vinai/PhoWhisper-medium")

# Dictionary to store channels and their connected clients
channels = {}
TIMEOUT = 60  # Timeout duration in seconds (adjust as needed)


async def process_audio_blob(blob_data):
    # audio = AudioSegment.from_file(fname, format="mp3")
    buffer = BytesIO(blob_data)
    buffer.name = "audio.webm"

    # transcription = pipe("audio/new-test.wav")
    # input_values = pipe.feature_extractor(buffer.read(), sampling_rate=16000) 
    # transcription_ids = pipe.model.generate(input_values.input_values)

    # transcription_text = pipe.tokenizer.decode(transcription_ids[0], skip_special_tokens=True)

    return transcription['text']

    # audio = AudioSegment.from_file(BytesIO(blob_data), format="webm")
    # audio = audio.set_frame_rate(16000).set_channels(1)  # 16kHz mono audio
    # wav_io = BytesIO()
    # audio.export(wav_io, format="wav")
    
    # Load the audio for PhoWhisper processing
    # input_values = torch.tensor([pipe.feature_extractor(wav_io.getvalue(), sampling_rate=16000).input_values])
    
    # Perform speech-to-text transcription
    # transcription = pipe.model.generate(input_values)
    
    # Convert the transcription from token ids to text
    # transcription_text = pipe.tokenizer.decode(transcription[0], skip_special_tokens=True)
    
    # return transcription_text
    return "hello world"

async def register(websocket, channel_name):
    if channel_name not in channels:
        channels[channel_name] = set()
    else: 
        print(f"Channel {channel_name} đã có người dùng")
    print(f"Client {websocket} registered to channel {channel_name}")
    channels[channel_name].add(websocket)
    await websocket.send(f"Kết nối thành công {channel_name}")

async def unregister(websocket, channel_name):
    if websocket in channels.get(channel_name, set()):
        channels[channel_name].remove(websocket)
        print(f"Client {websocket} rời khỏi {channel_name}")
        if not channels[channel_name]:
            print(f"Channel {channel_name} đã đóng")
            del channels[channel_name]

async def handler(websocket, path):
    if path.startswith("/api/speech-recognition/"):
        channel_name = path.split("/")[-1]  # Extract channel name from path
    else:
        await websocket.send("Channel hoặc URL không hợp lệ")
        await websocket.close()
        return

    # Register the client to the channel
    await register(websocket, channel_name)

    try:
        while True:
            try:
                # Wait for the next message with a timeout
                # blob_data = await asyncio.wait_for(websocket.recv(), timeout=TIMEOUT)
                blob_data = await websocket.recv()

                # Process the audio blob and get the transcription
                transcription = await process_audio_blob(blob_data)
                print(f"Transcription: {transcription}")

                # Broadcast the transcription to all clients in the same channel
                response = {
                    "text": transcription,
                    "language": "vi"  # Since it's PhoWhisper for Vietnamese
                }
                response_json = json.dumps(response)
                await websocket.send(response_json)


            except asyncio.TimeoutError:
                print(f"Connection timed out for channel {channel_name}. Closing connection.")
                await websocket.close()
                break  # Exit the loop if timeout occurs

    finally:
        # Unregister the client when they disconnect or timeout
        await unregister(websocket, channel_name)

# Start the WebSocket server
async def main():
    async with websockets.serve(handler, "localhost", 7001):
        print("WebSocket server is running on ws://localhost:7001/api/speech-recognition/{channel_name}")
        await asyncio.Future()  # Run forever

# Start the event loop
if __name__ == "__main__":
    asyncio.run(main())
