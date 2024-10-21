import asyncio
import websockets
from transformers import pipeline
import uuid
from pydub import AudioSegment
import io
import numpy as np
import soundfile as sf
import torch
import json
import subprocess
import tempfile
import wave

# Dictionary to store channels and their connected clients
channels = {}
TIMEOUT = 60  # Timeout duration in seconds (adjust as needed)

device = 0 if torch.cuda.is_available() else -1

pipe = pipeline("automatic-speech-recognition", model="vinai/PhoWhisper-medium", device=device)

async def process_audio(input_audio_data):
        file_name = f"audio/{uuid.uuid4()}.wav"

        with wave.open(file_name, mode='wb') as f:
            f.setnchannels(1)
            f.setframerate(32000)
            f.setsampwidth(2)
            f.writeframes(input_audio_data )

        transcription = pipe(file_name)

        return transcription['text']
        

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
                blob_data = await websocket.recv()
                # print("receive data: ",blob_data)
                # Process the audio blob and get the transcription
                transcription = await process_audio(blob_data)
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
