import { useState, useRef, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import PatientLayout from "../../layouts/PatientLayout";
import { Send, Bot, User, Sparkles, AlertTriangle, RotateCcw } from "lucide-react";
import { chatWithVitalis } from "../../api/vitalis.js";

// ─── Message rendering ────────────────────────────────────────────────────────

function MessageBubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex items-start gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
        isUser ? "bg-green-600" : "bg-blue-600"
      }`}>
        {isUser ? <User size={16} className="text-white" /> : <Bot size={16} className="text-white" />}
      </div>
      <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
        isUser
          ? "bg-green-600 text-white rounded-tr-sm"
          : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm"
      }`}>
        {msg.content}
      </div>
    </div>
  );
}

// ─── Suggested prompts ────────────────────────────────────────────────────────

const SUGGESTED_PROMPTS = [
  "Summarise my health records",
  "What are my lab values?",
  "What medications am I on?",
  "Show my pending follow-ups",
  "Explain my most recent report",
  "What is my health journey?",
];

// ─── Main Page ────────────────────────────────────────────────────────────────

function VitalisPage() {
  const { currentUser } = useAuth();

  const [history, setHistory] = useState([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, isTyping]);

  const addMessage = (role, content) => {
    setHistory((prev) => [
      ...prev,
      { id: `${role}-${Date.now()}`, role, content },
    ]);
  };

  const handleSend = async (text) => {
    const msg = text || input.trim();
    if (!msg || isTyping) return;
    setInput("");

    addMessage("user", msg);
    setIsTyping(true);

    try {
      // Patient JWT — no patientId param needed; backend reads from token
      const { answer } = await chatWithVitalis(msg);
      addMessage("assistant", answer);
    } catch (err) {
      addMessage(
        "assistant",
        `Sorry, I couldn't reach the server right now. Please try again in a moment.\n\n_${err.message}_`
      );
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <PatientLayout>
      <div className="flex flex-col h-screen max-h-screen">

        {/* Header */}
        <div className="p-8 pb-4 border-b bg-white shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center">
                <Sparkles size={22} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Vitalis</h1>
                <p className="text-sm text-slate-500">Your personal health intelligence assistant</p>
              </div>
            </div>
            {history.length > 0 && (
              <button
                onClick={() => setHistory([])}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition"
              >
                <RotateCcw size={13} /> New conversation
              </button>
            )}
          </div>

          {/* Disclaimer */}
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 mt-4 text-xs text-amber-700">
            <AlertTriangle size={13} className="shrink-0" />
            Vitalis provides information from your records only. It does not diagnose conditions.
            Always consult your doctor for medical decisions.
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-50">

          {/* Welcome */}
          {history.length === 0 && (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-4">
                <Sparkles size={36} className="text-white" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">Hello, {currentUser.name.split(" ")[0]}!</h2>
              <p className="text-slate-500 text-sm max-w-md mx-auto">
                I'm Vitalis. Ask me anything about your medical records, lab results, medications, or health history.
              </p>

              {/* Suggested prompts */}
              <div className="flex flex-wrap justify-center gap-2 mt-6">
                {SUGGESTED_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => handleSend(p)}
                    className="bg-white border border-slate-200 text-slate-700 text-sm px-4 py-2 rounded-full hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {history.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                <Bot size={16} className="text-white" />
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Suggested prompts (when conversation started) */}
        {history.length > 0 && history.length < 3 && (
          <div className="px-6 py-3 bg-white border-t flex flex-wrap gap-2">
            {SUGGESTED_PROMPTS.slice(0, 3).map((p) => (
              <button
                key={p}
                onClick={() => handleSend(p)}
                className="bg-slate-100 text-slate-600 text-xs px-3 py-1.5 rounded-full hover:bg-blue-50 hover:text-blue-700 transition"
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {/* Input area */}
        <div className="p-4 bg-white border-t shrink-0">
          <div className="flex gap-3 items-end">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your reports, medications, lab values..."
              rows={1}
              className="flex-1 border border-slate-300 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 max-h-32"
              style={{ minHeight: "46px" }}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isTyping}
              className="bg-blue-600 text-white rounded-xl px-4 py-3 hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={18} />
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-2 text-center">
            Press Enter to send · Shift+Enter for new line
          </p>
        </div>

      </div>
    </PatientLayout>
  );
}

export default VitalisPage;
