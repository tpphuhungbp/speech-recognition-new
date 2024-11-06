import React from "react";
import logo from "./logo.svg";
import "./App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./component/Home";
import StreamingAudioWaveFile from "./component/StreamingAudioWaveFile";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/streaming" element={<StreamingAudioWaveFile />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
