import asyncio
import websockets
from transformers import pipeline
import uuid
import torch
import json
import wave
import struct

##### Dictionary to store channels and their connected clients
channels = {}
FRAME_RATE = 44100
NUM_CHANNELS= 1
BYTES_PER_SAMPLE = 2
SERVER_URL= "ws://localhost:7001/api/speech-recognition/{channel_name}"
FORMAT_CHECK_URL= "ws://localhost:7002/"

##########################################################################
##### AI Section #####

device = 0 if torch.cuda.is_available() else -1

pipe = pipeline("automatic-speech-recognition", model="vinai/PhoWhisper-small", device=device)

async def process_audio(input_audio_data):
        file_name = f"audio/{uuid.uuid4()}.wav"

        with wave.open(file_name, mode='wb') as f:
            f.setnchannels(NUM_CHANNELS)
            f.setframerate(FRAME_RATE)
            f.setsampwidth(BYTES_PER_SAMPLE)
            f.writeframes(input_audio_data )

        transcription = pipe(file_name)

        return transcription['text']

##### END AI Section #####
##########################################################################
### Speech ToText Websocket handler ###

async def register(websocket, channel_name):
    if channel_name not in channels:
        channels[channel_name] = set()
    else: 
        print(f"[CONNECTION] Channel {channel_name} đã có người dùng")
    print(f"[CONNECTION] Client {websocket} registered to channel {channel_name}")
    channels[channel_name].add(websocket)
    await websocket.send(f"Kết nối thành công {channel_name}")

async def unregister(websocket, channel_name):
    if websocket in channels.get(channel_name, set()):
        channels[channel_name].remove(websocket)
        print(f"[CONNECTION] Client {websocket} rời khỏi {channel_name}")
        if not channels[channel_name]:
            print(f"[CONNECTION] Channel {channel_name} đã đóng")
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
                print(f"[AI SPEECH TO TEXT]Transcription: {transcription}")

                # Broadcast the transcription to all clients in the same channel
                response = {
                    "text": transcription,
                    "language": "vi"  # Since it's PhoWhisper for Vietnamese
                }
                response_json = json.dumps(response)
                await websocket.send(response_json)


            except asyncio.TimeoutError:
                print(f"[CONNECTION] Connection timed out for channel {channel_name}. Closing connection.")
                await websocket.close()
                break  # Exit the loop if timeout occurs

    finally:
        # Unregister the client when they disconnect or timeout
        await unregister(websocket, channel_name)

### END Speech ToText Websocket handler ###
##########################################################################
### Format Check Websocket handler ###

def is_wav_and_parse_header(data):
    if len(data) < 44:
        print("[FORMAT] Data is too short to be a valid WAV file header.")
        return False
    
    # Check for 'RIFF' and 'WAVE' identifiers
    if data[:4] != b'RIFF' or data[8:12] != b'WAVE':
        print("[FORMAT] This is not a valid WAV file.")
        return False

    # Parse WAV header fields
    chunk_size = struct.unpack('<I', data[4:8])[0]
    audio_format = struct.unpack('<H', data[20:22])[0]
    num_channels = struct.unpack('<H', data[22:24])[0]
    sample_rate = struct.unpack('<I', data[24:28])[0]
    byte_rate = struct.unpack('<I', data[28:32])[0]
    block_align = struct.unpack('<H', data[32:34])[0]
    bits_per_sample = struct.unpack('<H', data[34:36])[0]

    # Log the WAV header
    print("[FORMAT INFO] WAV Header Information:")
    print(f"  Chunk Size: {chunk_size}")
    print(f"  Audio Format: {audio_format}")
    print(f"  Number of Channels: {num_channels}")
    print(f"  Sample Rate: {sample_rate}")
    print(f"  Byte Rate: {byte_rate}")
    print(f"  Block Align: {block_align}")
    print(f"  Bits Per Sample: {bits_per_sample}")

    return True

async def handler_for_type_check(websocket, path):
    print("[CONNECTION] Client connected.")
    try:
        async for message in websocket:
            # Convert message to bytes if it's not already
            if isinstance(message, str):
                message = message.encode('utf-8')
            
            # Check if the message is a WAV file and log the header
            if is_wav_and_parse_header(message[:44]):
                print("Valid WAV file received.")
            else:
                print("Received data is not a WAV file.")
    except websockets.exceptions.ConnectionClosed as e:
        print(f"[CONNECTION] Connection closed: {e}")

### END Format Check Websocket handler ###
##########################################################################
# Start the WebSocket server

async def keep_running():
    # Dummy task to keep the loop running indefinitely
    while True:
        await asyncio.sleep(3600)

async def main():

    #Server để test AI Speech to Text PORT 7001
    #URL = "ws://localhost:7001/api/speech-recognition/{channel_name}"

    server1 = websockets.serve(handler, "localhost", 7001)
    server2 = websockets.serve(handler_for_type_check, "localhost", 7002)
    
    print(f"[INFO] WebSocket server is running on {SERVER_URL}")
    print(f"[INFO] Format check WebSocket server started at {FORMAT_CHECK_URL}")

    # Run both servers in parallel
    await asyncio.gather(keep_running(),server1, server2)

# Start the event loop
if __name__ == "__main__":
    asyncio.run(main())
