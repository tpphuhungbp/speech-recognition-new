import React, { useRef, useState } from "react";
import { URL_WEBSOCKET } from "./Constant";

const StreamingAudioWaveFile = () => {
  const [file, setFile] = useState<File | null>(null);
  const [wsUrl, setWsUrl] = useState(URL_WEBSOCKET.SPEECH_TO_TEXT);
  const [currentURL, setCurrentURL] = useState(URL_WEBSOCKET.SPEECH_TO_TEXT);
  const [isConnected, setIsConnected] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const webSocketObject = useRef<WebSocket | null>(null);
  const [receivedData, setReceivedData] = useState<string[]>([]);
  const fileReaderRef = useRef<FileReader | null>(null);
  const audioChunksRef = useRef<Uint8Array[]>([]);
  const [header, setHeader] = useState<any>(null);

  const connectToUrl1 = () => setWsUrl(URL_WEBSOCKET.SPEECH_TO_TEXT);
  const connectToUrl2 = () => setWsUrl(URL_WEBSOCKET.FORMAT_CHECK);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setFile(event.target.files[0]);
    }
  };

  const readWavHeader = async (arrayBuffer: ArrayBuffer) => {
    const header = new DataView(arrayBuffer);

    // Sample fields to extract from the WAV header
    const chunkId = String.fromCharCode(
      header.getUint8(0),
      header.getUint8(1),
      header.getUint8(2),
      header.getUint8(3)
    );
    const format = String.fromCharCode(
      header.getUint8(8),
      header.getUint8(9),
      header.getUint8(10),
      header.getUint8(11)
    );
    const audioFormat = header.getUint16(20, true);
    const numChannels = header.getUint16(22, true);
    const sampleRate = header.getUint32(24, true);
    const byteRate = header.getUint32(28, true);
    const blockAlign = header.getUint16(32, true);
    const bitsPerSample = header.getUint16(34, true);
    const newHeader = {
      chunkId,
      format,
      audioFormat,
      numChannels,
      sampleRate,
      byteRate,
      blockAlign,
      bitsPerSample,
    };
    console.log("WAV Header:", newHeader);
    setHeader(newHeader);
  };

  //###########################################################
  //####################STREAMFILE#############################
  const startStreaming = () => {
    if (!file) return;
    setIsStreaming(true);
    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      if (isConnected === false) {
        setIsConnected(true);
        webSocketObject.current = ws;
        streamAudioFile(file, ws);
        console.log("WebSocket connected");
      }
    };

    ws.onmessage = (event) => {
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

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  };

  const stopStreaming = () => {
    webSocketObject.current?.close();
    setIsStreaming(false);
  };

  const streamAudioFile = (file: File, ws: WebSocket) => {
    if (!file) return;

    const chunkSize = 32 * 1024; // 32 kB per chunk
    const fileReader = new FileReader();
    fileReaderRef.current = fileReader;

    fileReader.onload = () => {
      if (fileReader.result) {
        const byteArray = new Uint8Array(fileReader.result as ArrayBuffer);
        audioChunksRef.current.push(byteArray); // Store the byteArray;

        // Send chunks over WebSocket
        sendAudioChunks(byteArray, chunkSize, ws);
      }
    };

    fileReader.readAsArrayBuffer(file);
  };

  const sendAudioChunks = (audioData: Uint8Array, chunkSize: number, ws: WebSocket) => {
    const totalChunks = Math.ceil(audioData.length / chunkSize);
    let chunkIndex = 0;

    const sendChunk = () => {
      if (chunkIndex < totalChunks) {
        const start = chunkIndex * chunkSize;
        const end = Math.min((chunkIndex + 1) * chunkSize, audioData.length);
        const chunk = audioData.slice(start, end);

        // Send the chunk through WebSocket
        if (ws) {
          ws.send(chunk);
        }

        chunkIndex++;
        setTimeout(sendChunk, 1000); // Delay to simulate 32 kB per second
      } else {
        stopStreaming();
      }
    };

    sendChunk();
  };

  //###########################################################
  //####################UPLOADFILE#############################
  const uploadFile = async () => {
    if (!file) return;

    const arrayBuffer = await file.arrayBuffer();
    await readWavHeader(arrayBuffer);

    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      if (isConnected === false) {
        setIsConnected(true);
        console.log("WebSocket connected");
        ws.send(arrayBuffer);
        ws.close();
        setIsConnected(false);
      }
    };

    ws.onmessage = (event) => {
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

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };
  };

  //###########################################################
  return (
    <div style={{ display: "flex", flexDirection: "row", gap: "20px", padding: "60px" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "start",
          gap: "20px",
        }}
      >
        <button onClick={() => (window.location.href = "/")}>
          Go to streaming audio Speech to Text
        </button>
        <h1>Streaming audio file</h1>
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
        <input type="file" accept=".wav" onChange={handleFileChange} />

        <button onClick={uploadFile} disabled={!file}>
          Upload nguyên file WAV
        </button>

        <div style={{ display: "flex", gap: "20px" }}>
          <button onClick={startStreaming} disabled={!file}>
            Stream WAV
          </button>
          {isStreaming && <button onClick={stopStreaming}>Stop Streaming</button>}
        </div>

        <h2>Received Data:</h2>
        {receivedData ? (
          <pre>{JSON.stringify(Array.from(receivedData), null, 2)}</pre>
        ) : (
          <p>No data received.</p>
        )}
      </div>
      <div>
        <h1>Headers</h1>
        <p>ChunksID: {header?.chunkId}</p>
        <p>Format: {header?.format}</p>
        <p>AudioFormat: {header?.audioFormat}</p>
        <p>NumChannels: {header?.numChannels}</p>
        <p>SampleRate: {header?.sampleRate}</p>
        <p>ByteRate: {header?.byteRate}</p>
        <p>BlockAlign: {header?.blockAlign}</p>
        <p>BitsPerSample: {header?.bitsPerSample}</p>
      </div>
    </div>
  );
};

export default StreamingAudioWaveFile;
