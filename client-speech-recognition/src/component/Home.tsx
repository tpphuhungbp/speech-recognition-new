import { MediaRecorder, IMediaRecorder, register } from "extendable-media-recorder";
import { connect } from "extendable-media-recorder-wav-encoder";
import React, { useRef, useState } from "react";
import { URL_WEBSOCKET } from "./Constant";

const Home = () => {
  const [audioSocket, setAudioSocket] = useState<WebSocket | null>(null);
  const mediaRecorderRef = useRef<IMediaRecorder | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [receivedData, setReceivedData] = useState<string[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null); // State to hold audio URL
  const [wsUrl, setWsUrl] = useState(URL_WEBSOCKET.SPEECH_TO_TEXT);
  const [currentURL, setCurrentURL] = useState(URL_WEBSOCKET.SPEECH_TO_TEXT);

  const audioChunksRef = useRef<Blob[]>([]);

  const connectToUrl1 = () => setWsUrl(URL_WEBSOCKET.SPEECH_TO_TEXT);
  const connectToUrl2 = () => setWsUrl(URL_WEBSOCKET.FORMAT_CHECK);

  const connectWebSocket = () => {
    const socket = new WebSocket(wsUrl);
    setCurrentURL(wsUrl);

    socket.onopen = () => {
      console.log("Connected to WebSocket server");
      setAudioSocket(socket);
      setIsConnected(true);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.text && data.language) {
          setReceivedData((prevData) => [...prevData, data.text]);
        } else {
          console.error("Unexpected message format:", data);
        }
      } catch (error) {
        console.log(error);
      }
    };

    socket.onclose = () => {
      console.log("Disconnected from WebSocket server");
      setAudioSocket(null);
      setIsConnected(false);
    };
  };

  const disconnectWebSocket = () => {
    if (audioSocket) {
      audioSocket.close();
    }
  };

  const startRecording = async () => {
    try {
      await register(await connect());
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, sampleRate: 16000 },
      });

      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: "audio/wav" });

      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContext.destination.channelCount = 1;
      audioContext.destination.channelCountMode = "explicit";
      const mediaStreamAudioSourceNode = new MediaStreamAudioSourceNode(audioContext, {
        mediaStream: stream,
      });

      const mediaStreamAudioDestinationNode = new MediaStreamAudioDestinationNode(audioContext);

      mediaStreamAudioDestinationNode.channelCount = 1;
      mediaStreamAudioDestinationNode.channelCountMode = "explicit";
      mediaStreamAudioSourceNode.connect(mediaStreamAudioDestinationNode);

      mediaRecorderRef.current = new MediaRecorder(mediaStreamAudioDestinationNode.stream, {
        mimeType: "audio/wav",
      });
      // const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // mediaRecorderRef.current = new MediaRecorder(stream);

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (audioSocket && audioSocket.readyState === WebSocket.OPEN && event.data.size > 0) {
          audioChunksRef.current.push(event.data);

          // Truyen buffer
          // const blob = event.data;
          // const reader = new FileReader();
          // reader.readAsArrayBuffer(blob);
          // reader.onloadend = () => {
          //   // Send the audio buffer to WebSocket server
          //   if (reader.result) {
          //     audioSocket.send(reader.result);
          //     console.log("Sent audio data to server:", reader.result);
          //   }
          // };
          audioSocket.send(event.data);
          console.log("Sent audio data to server:", event.data);
        }
      };

      mediaRecorderRef.current.start(4000); // Start recording with chunk size of 100ms or every 100ms
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.onstop = () => {
        const audioUrl = URL.createObjectURL(
          new Blob(audioChunksRef.current, { type: "audio/wav" })
        );
        setAudioUrl(audioUrl);
      };
      setIsRecording(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "start",
        gap: "20px",
        padding: "60px",
      }}
    >
      <button onClick={() => (window.location.href = "/streaming")}>Go to Streaming file</button>
      <h1>Speech to Text Service</h1>
      <h5>
        Current Connected URL:{" "}
        {isConnected
          ? currentURL === URL_WEBSOCKET.SPEECH_TO_TEXT
            ? "Speech to Text"
            : "Format Check"
          : "None"}
      </h5>
      <div style={{ display: "flex", gap: "20px" }}>
        <div>
          <input
            type="radio"
            name="wsUrl"
            id="url1"
            checked={wsUrl === URL_WEBSOCKET.SPEECH_TO_TEXT}
            onChange={() => connectToUrl1()}
          />
          <label htmlFor="url1" className="radio-circle">
            Speech to Text
          </label>
        </div>
        <div>
          <input
            type="radio"
            name="wsUrl"
            id="url2"
            checked={wsUrl === URL_WEBSOCKET.FORMAT_CHECK}
            onChange={() => connectToUrl2()}
          />
          <label htmlFor="url2" className="radio-circle">
            Format Check
          </label>
        </div>
      </div>
      <button onClick={isConnected ? disconnectWebSocket : connectWebSocket}>
        {isConnected ? "Disconnect" : "Connect"}
      </button>
      <br />
      <button onClick={startRecording} disabled={isRecording || !isConnected}>
        Start Streaming
      </button>
      <button onClick={stopRecording} disabled={!isRecording}>
        Stop Streaming
      </button>

      {audioUrl && (
        <div>
          <h2>Saved Audio Playback:</h2>
          <audio controls src={audioUrl} />
        </div>
      )}
      <h2>Received Data:</h2>
      {receivedData ? (
        <pre>{JSON.stringify(Array.from(receivedData), null, 2)}</pre>
      ) : (
        <p>No data received.</p>
      )}
    </div>
  );
};
export default Home;
