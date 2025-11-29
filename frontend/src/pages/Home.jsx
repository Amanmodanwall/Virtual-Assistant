import React, { useEffect, useRef, useContext, useState, useCallback } from "react";
import axios from "axios";
import { userDataContext } from "../context/userContext";
import { useNavigate } from "react-router-dom";
import aiImg from "../assets/ai.gif";
import userImg from "../assets/user.gif";

/**
 * Home.jsx
 * - Keeps assistant image visible
 * - When assistant speaks, shows GIF BELOW the assistant name (as requested)
 * - Keeps previous features: auto mic, wake-word includes, TTS lang selection, audio-unblock overlay
 */

function detectLanguage(text) {
  const hindiRegex = /[\u0900-\u097F]/;
  return hindiRegex.test(text) ? "hi" : "en";
}

function Home() {
  const { userData, serverUrl, setUserData, getGeminiResponse } = useContext(userDataContext);
  const navigate = useNavigate();

  // refs & state
  const recognitionRef = useRef(null);
  const recognitionRunningRef = useRef(false);
  const restartingRef = useRef(false);
  const isSpeaking = useRef(false);
  const synthRef = useRef(typeof window !== "undefined" ? window.speechSynthesis : null);
  const onResultHandlerRef = useRef(null);
  const lastUtterRef = useRef(null);

  const [listening, setListening] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [voicesList, setVoicesList] = useState([]);
  const [preferredHiVoiceURI, setPreferredHiVoiceURI] = useState(null);
  const [preferredEnVoiceURI, setPreferredEnVoiceURI] = useState(null);

  // UI text states
  const [userText, setUserText] = useState("");
  const [aiText, setAiText] = useState(""); // non-empty while speaking

  // ---------- Logout ----------
  const handleLogOut = async () => {
    try {
      await axios.get(`${serverUrl}/api/auth/logout`, { withCredentials: true });
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setUserData(null);
      navigate("/signin");
    }
  };

  // ---------- voice helpers ----------
  const loadVoices = useCallback(() => {
    try {
      if (!synthRef.current) return [];
      const v = synthRef.current.getVoices() || [];
      const arr = v.map((voice) => ({
        name: voice.name,
        lang: voice.lang,
        uri: voice.voiceURI,
        default: voice.default,
        localService: voice.localService,
      }));
      setVoicesList(arr);
      console.log("TTS voices:", arr);
      return arr;
    } catch (e) {
      console.warn("loadVoices error:", e);
      return [];
    }
  }, []);

  useEffect(() => {
    if (!synthRef.current) return;
    const handler = () => loadVoices();
    synthRef.current.onvoiceschanged = handler;
    loadVoices();
    return () => {
      if (synthRef.current) synthRef.current.onvoiceschanged = null;
    };
  }, [loadVoices]);

  const pickVoice = useCallback((lang) => {
    const voices = synthRef.current?.getVoices() || [];
    if (!voices.length) return null;

    if (lang === "hi") {
      let v = voices.find((x) => x.lang && x.lang.toLowerCase().startsWith("hi"));
      if (v) return v;
      v = voices.find((x) => x.name && /hindi|hindu|hi(in)?/i.test(x.name));
      if (v) return v;
      v = voices.find((x) => x.lang && x.lang.toLowerCase().includes("hi"));
      if (v) return v;
      v = voices.find((x) => x.lang && x.lang.toLowerCase().startsWith("en-in"));
      if (v) return v;
      v = voices.find((x) => x.lang && x.lang.toLowerCase().startsWith("en-gb"));
      if (v) return v;
      v = voices.find((x) => x.lang && x.lang.toLowerCase().startsWith("en"));
      if (v) return v;
      return voices[0];
    } else {
      let v = voices.find((x) => x.lang && x.lang.toLowerCase().startsWith("en-us"));
      if (v) return v;
      v = voices.find((x) => x.lang && x.lang.toLowerCase().startsWith("en-gb"));
      if (v) return v;
      v = voices.find((x) => x.lang && x.lang.toLowerCase().startsWith("en"));
      if (v) return v;
      return voices[0];
    }
  }, []);

  // ---------- audio unlock helper ----------
  const audioCtxRef = useRef(null);
  const unlockAudioWithUserGesture = async () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtxRef.current.state === "suspended") {
        await audioCtxRef.current.resume();
      }
      loadVoices();
      setAudioBlocked(false);

      const last = lastUtterRef.current;
      if (last) {
        setTimeout(() => {
          speakInternal(last.text, last.lang, { retrying: true });
        }, 250);
      }
    } catch (err) {
      console.warn("unlockAudio error:", err);
    }
  };

  // ---------- speak implementation ----------
  const speakInternal = (text, lang = "en", opts = {}) => {
    if (!text || !synthRef.current) return;
    try {
      lastUtterRef.current = { text, lang };

      try {
        synthRef.current.cancel();
      } catch (e) {}
      isSpeaking.current = true;

      // set aiText -> this will cause GIF BELOW the assistant name to show
      setAiText(text);

      // stop recognition (avoid self-hearing)
      try {
        if (recognitionRef.current && recognitionRunningRef.current) {
          recognitionRef.current.onresult = null;
          recognitionRef.current.stop();
          recognitionRunningRef.current = false;
        }
      } catch (e) {}

      const utter = new SpeechSynthesisUtterance(String(text));
      let chosen = null;
      if (lang === "hi" && preferredHiVoiceURI) {
        chosen = (synthRef.current.getVoices() || []).find((v) => v.voiceURI === preferredHiVoiceURI);
      } else if (lang === "en" && preferredEnVoiceURI) {
        chosen = (synthRef.current.getVoices() || []).find((v) => v.voiceURI === preferredEnVoiceURI);
      }
      if (!chosen) chosen = pickVoice(lang);

      utter.lang = lang === "hi" ? "hi-IN" : "en-US";
      if (chosen) utter.voice = chosen;

      utter.rate = lang === "hi" ? 0.95 : 1;
      utter.pitch = 1;
      utter.volume = 1;

      utter.onend = () => {
        isSpeaking.current = false;
        setAiText(""); // hide GIF below heading
        // restart recognition safely
        setTimeout(() => {
          try {
            if (recognitionRef.current && !recognitionRunningRef.current) {
              recognitionRef.current.onresult = onResultHandlerRef.current;
              try {
                recognitionRef.current.start();
                recognitionRunningRef.current = true;
              } catch (e) {
                console.warn("Could not restart recognition after speaking:", e);
              }
            }
          } catch (e) {}
        }, 200);
      };

      utter.onerror = (ev) => {
        console.error("TTS utterance error:", ev);
        isSpeaking.current = false;
        setAudioBlocked(true);
        lastUtterRef.current = { text, lang };
      };

      try {
        synthRef.current.speak(utter);
      } catch (err) {
        console.error("synth.speak threw:", err);
        setAudioBlocked(true);
        isSpeaking.current = false;
        setAiText("");
      }
    } catch (err) {
      console.error("speakInternal error:", err);
      isSpeaking.current = false;
      setAiText("");
    }
  };

  const speak = (text, lang = "en") => {
    lastUtterRef.current = { text, lang };
    speakInternal(text, lang);
  };

  // ---------- onResult handler ----------
  const buildOnResult = useCallback(() => {
    return async function onResult(e) {
      try {
        const lastIndex = e.results.length - 1;
        const lastResult = e.results[lastIndex];
        if (!lastResult || !lastResult.isFinal) return;

        const transcript = lastResult[0].transcript.trim();
        const confidence = lastResult[0].confidence ?? 0;
        console.log("Heard:", transcript, "| confidence:", confidence);

        if (confidence < 0.55 || transcript.split(" ").length < 1) {
          console.log("Ignored (low confidence or too short)");
          return;
        }

        const assistantName = userData?.assistantName?.toLowerCase();
        if (!assistantName) {
          console.warn("Assistant name not set.");
          return;
        }

        const lower = transcript.toLowerCase();
        if (!lower.includes(assistantName)) {
          console.log("Assistant name not detected — ignoring");
          return;
        }

        const cleaned = lower.replace(assistantName, "").trim();
        const finalUserInput = cleaned || transcript;
        console.log("Final user input for Gemini:", finalUserInput);

        setUserText(finalUserInput);

        const spokenLang = detectLanguage(finalUserInput);

        const data = await getGeminiResponse(finalUserInput);
        console.log("Gemini response:", data);

        const responseText =
          typeof data === "string"
            ? data
            : data?.response || data?.text || data?.message || data?.output || null;

        const type = data?.type || null;

        if (!responseText) {
          console.warn("No response text found in Gemini data:", data);
          return;
        }

        // speak in detected language
        speak(responseText, spokenLang);

        // optional commands (fire-and-forget)
        if (type === "google-search") {
          window.open(`https://www.google.com/search?q=${encodeURIComponent(finalUserInput)}`, "_blank");
        } else if (type === "youtube-search" || type === "youtube_play") {
          window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(finalUserInput)}`, "_blank");
        } else if (type === "instagram-open") {
          window.open("https://www.instagram.com/", "_blank");
        } else if (type === "facebook-open") {
          window.open("https://www.facebook.com/", "_blank");
        } else if (type === "weather-show") {
          window.open("https://www.google.com/search?q=weather", "_blank");
        }
      } catch (err) {
        console.error("onresult handler error:", err);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getGeminiResponse, userData?.assistantName]);

  useEffect(() => {
    onResultHandlerRef.current = buildOnResult();
  }, [buildOnResult]);

  // ---------- recognition setup & auto-start ----------
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("SpeechRecognition API not supported in this browser.");
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = onResultHandlerRef.current;
        if (!isSpeaking.current && !recognitionRunningRef.current) {
          try {
            recognitionRef.current.start();
            recognitionRunningRef.current = true;
          } catch (e) {
            // ignore already-started errors
          }
        }
      } catch (e) {}
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setListening(true);
      recognitionRunningRef.current = true;
      console.log("Recognition started");
    };

    recognition.onresult = (e) => {
      try {
        onResultHandlerRef.current?.(e);
      } catch (err) {
        console.error("delegated onresult error:", err);
      }
    };

    recognition.onerror = (ev) => {
      console.error("Speech recognition error:", ev);
      const errName = ev?.error || "";
      if (errName === "aborted") {
        restartingRef.current = true;
        setTimeout(() => {
          try {
            if (!isSpeaking.current && recognitionRef.current && !recognitionRunningRef.current) {
              recognitionRef.current.start();
              recognitionRunningRef.current = true;
            }
          } catch (e) {}
          restartingRef.current = false;
        }, 1000);
      } else if (errName === "not-allowed" || errName === "permission-denied") {
        console.error("Microphone permission denied. Please allow microphone access.");
        setListening(false);
      } else {
        setTimeout(() => {
          try {
            if (!isSpeaking.current && recognitionRef.current && !recognitionRunningRef.current) {
              recognitionRef.current.start();
              recognitionRunningRef.current = true;
            }
          } catch (e) {}
        }, 800);
      }
    };

    recognition.onend = () => {
      setListening(false);
      recognitionRunningRef.current = false;
      console.log("Recognition ended");
      if (isSpeaking.current) {
        console.log("Not restarting because TTS is speaking");
        return;
      }
      if (!restartingRef.current) {
        restartingRef.current = true;
        setTimeout(() => {
          try {
            if (recognitionRef.current && !recognitionRunningRef.current) {
              recognitionRef.current.start();
              recognitionRunningRef.current = true;
            }
          } catch (e) {}
          restartingRef.current = false;
        }, 500);
      }
    };

    try {
      recognition.onresult = onResultHandlerRef.current;
      recognition.start();
      recognitionRunningRef.current = true;
    } catch (err) {
      console.warn("Recognition start error (initial):", err);
    }

    return () => {
      try {
        if (recognitionRef.current) {
          recognitionRef.current.onresult = null;
          recognitionRef.current.onend = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.onstart = null;
          try {
            recognitionRef.current.stop();
          } catch (e) {}
        }
      } catch (e) {}
      recognitionRef.current = null;
      recognitionRunningRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onResultHandlerRef.current]);

  // cancel speech / recognition on unmount
  useEffect(() => {
    return () => {
      try {
        synthRef.current?.cancel();
        recognitionRef.current?.stop();
      } catch (e) {}
    };
  }, []);

  // ---------- UI helpers ----------
  const voiceOptions = voicesList.map((v) => ({ label: `${v.name} (${v.lang})`, uri: v.uri }));

  return (
    <div className="w-full h-[100vh] bg-gradient-to-t from-black to-[#02023d] flex justify-center items-center flex-col gap-[15px] relative">
      {/* top controls */}
      <div className="absolute top-[16px] right-[16px] flex flex-col gap-2 items-end z-40">
        <button
          onClick={handleLogOut}
          className="min-w-[140px] h-[44px] rounded-full bg-white text-black font-semibold"
        >
          Log Out
        </button>
        <button
          onClick={() => navigate("/customize")}
          className="min-w-[140px] h-[44px] rounded-full bg-white text-black font-semibold"
        >
          Customize
        </button>

        <div className="text-sm text-gray-300 mt-2">
          {listening ? "🎙️ Listening" : isSpeaking.current ? "🔊 Speaking" : "💤 Idle"}
        </div>

        {/* voice picker pill */}
        <div className="mt-2 bg-white/10 p-2 rounded-md text-xs text-gray-200">
          <div className="flex gap-2 items-center">
            <span className="font-semibold">Voice (Hi):</span>
            <select
              value={preferredHiVoiceURI || ""}
              onChange={(e) => setPreferredHiVoiceURI(e.target.value || null)}
              className="bg-transparent text-xs text-gray-200"
            >
              <option value="">auto</option>
              {voiceOptions.map((opt) => (
                <option key={opt.uri} value={opt.uri}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 items-center mt-1">
            <span className="font-semibold">Voice (En):</span>
            <select
              value={preferredEnVoiceURI || ""}
              onChange={(e) => setPreferredEnVoiceURI(e.target.value || null)}
              className="bg-transparent text-xs text-gray-200"
            >
              <option value="">auto</option>
              {voiceOptions.map((opt) => (
                <option key={opt.uri} value={opt.uri}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* assistant image container */}
      <div className="w-[300px] h-[400px] rounded-3xl shadow-lg overflow-hidden relative">
        {/* main assistant image (always visible) */}
        <img
          src={userData?.assistantImage}
          className="w-full h-full object-cover"
          alt="assistant"
        />
      </div>

      {/* assistant name */}
      <h1 className="text-white text-[18px] font-semibold mt-4">I'm {userData?.assistantName || "Assistant"}</h1>

      {/* GIF BELOW heading when speaking */}
      <div className="mt-2 min-h-[64px] flex items-center justify-center">
        {aiText ? (
          <div className="flex flex-col items-center gap-2">
            <img src={aiImg} alt="assistant speaking" className="w-[160px] h-auto" />
            <div className="text-gray-300 text-sm max-w-[600px] text-center">Jarvis: {aiText}</div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            {/* idle state: show small user icon and optionally last user text */}
            <img src={userImg} alt="user" className="w-[160px] h-auto" />
            {userText && <div className="text-gray-500 text-sm max-w-[600px] text-center">You: {userText}</div>}
          </div>
        )}
      </div>

      {/* audio blocked overlay (one-tap) */}
      {audioBlocked && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
          onClick={(e) => {
            e.stopPropagation();
            unlockAudioWithUserGesture();
          }}
        >
          <div className="bg-white text-black p-6 rounded-lg shadow-lg text-center max-w-sm">
            <p className="mb-4 font-semibold">Audio blocked by browser</p>
            <p className="text-sm mb-4">Tap anywhere to enable speech (one-time gesture)</p>
            <button
              onClick={(ev) => {
                ev.stopPropagation();
                unlockAudioWithUserGesture();
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded"
            >
              Enable audio
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
