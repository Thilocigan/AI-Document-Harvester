import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X, Sparkles, Bot, User, Trash2, BookOpen, ExternalLink, HelpCircle } from 'lucide-react';

const SUGGESTED_QUESTIONS = [
  "Summarize the key metrics and KPIs across all documents",
  "What are the primary risk factors and compliance mandates?",
  "Compare the strategic initiatives outlined in the reports",
  "What are the latency benchmarks and architectural targets?"
];

export default function RAGChatSidebar({
  isOpen,
  onClose,
  jobId,
  isJobReady,
  openaiKey,
  geminiKey
}) {
  const [messages, setMessages] = useState([
    {
      sender: 'assistant',
      text: 'Hello! I am your AI Document Assistant. Once your domain has been crawled and processed, you can ask me any question across all scanned PDF documents.',
      sources: []
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async (questionText = null) => {
    const textToSend = questionText || inputValue;
    if (!textToSend.trim() || isLoading) return;

    if (!jobId) {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'user',
          text: textToSend
        },
        {
          sender: 'assistant',
          text: 'Please start a crawl pipeline first so I have ingested documents to analyze!',
          sources: []
        }
      ]);
      setInputValue('');
      return;
    }

    const userMessage = { sender: 'user', text: textToSend };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: jobId,
          question: textToSend,
          openai_api_key: openaiKey || undefined,
          gemini_api_key: geminiKey || undefined
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: data.answer || 'No response generated.',
          sources: data.sources || []
        }
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: `Error querying documents: ${err.message}. Please check if the pipeline has finished processing.`,
          sources: []
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    setMessages([
      {
        sender: 'assistant',
        text: 'Chat history cleared. How can I assist you with your consolidated documents?',
        sources: []
      }
    ]);
  };

  if (!isOpen) return null;

  return (
    <aside className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 md:w-[440px] bg-white border-l border-slate-200 shadow-2xl flex flex-col transition-all">
      
      {/* Header */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-green-100 text-green-700 border border-green-200">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-black flex items-center gap-1.5">
              <span>RAG Document Chat</span>
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            </h3>
            <p className="text-[11px] text-slate-500 font-mono">
              Multi-Document Grounded Retrieval
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleClear}
            className="p-1.5 text-slate-400 hover:text-black rounded-lg hover:bg-slate-100 transition-colors"
            title="Clear Chat"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-black rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Suggested Questions */}
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max">
          <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-green-600" /> Prompts:
          </span>
          {SUGGESTED_QUESTIONS.map((q, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSend(q)}
              className="text-[11px] px-2.5 py-1 rounded-full bg-white hover:bg-green-50 border border-slate-200 text-slate-700 hover:text-green-800 hover:border-green-300 transition-colors truncate max-w-[210px] shadow-xs"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Message List */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/40">
        {messages.map((msg, index) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={index}
              className={`flex items-start gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {!isUser && (
                <div className="w-7 h-7 rounded-lg bg-green-100 text-green-700 flex items-center justify-center shrink-0 border border-green-200 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed ${
                  isUser
                    ? 'bg-green-600 text-white rounded-tr-none shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-xs'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.text}</div>

                {/* Source Citations */}
                {!isUser && msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1.5">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <BookOpen className="w-3 h-3 text-green-600" /> Cited Sources:
                    </p>
                    <div className="space-y-1">
                      {msg.sources.map((src, sIdx) => (
                        <div
                          key={sIdx}
                          className="p-2 rounded-lg bg-green-50/60 border border-green-200 text-[11px] text-slate-600"
                        >
                          <div className="flex items-center justify-between text-green-800 font-bold mb-0.5">
                            <span>{src.filename}</span>
                            <span>Page {src.page_number}</span>
                          </div>
                          <p className="line-clamp-2 italic text-slate-600">"{src.excerpt}"</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {isUser && (
                <div className="w-7 h-7 rounded-lg bg-slate-800 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-green-100 text-green-700 flex items-center justify-center shrink-0 border border-green-200">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none p-3.5 text-xs text-slate-600 flex items-center gap-2 shadow-xs">
              <div className="w-2 h-2 rounded-full bg-green-600 animate-ping" />
              <span>Scanning document vectors &amp; formulating synthesis...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div className="p-4 border-t border-slate-200 bg-white">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask anything about the PDFs..."
            className="flex-1 bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm text-black placeholder-slate-400 focus:outline-none focus:border-green-500 focus:bg-white transition-all font-medium"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="p-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
        <p className="text-[10px] text-slate-400 text-center mt-2 font-mono">
          Powered by TF-IDF / LLM Grounded RAG with source verification
        </p>
      </div>

    </aside>
  );
}
