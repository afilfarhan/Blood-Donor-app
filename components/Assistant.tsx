
import React, { useState, useRef, useEffect } from 'react';
import { Person, ChatMessage } from '../types';
import { getGeminiResponse } from '../services/gemini';

interface AssistantProps {
  people: Person[];
}

const Assistant: React.FC<AssistantProps> = ({ people }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: ChatMessage = { role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    const response = await getGeminiResponse(input, people);
    const botMessage: ChatMessage = { role: 'model', text: response };
    
    setMessages(prev => [...prev, botMessage]);
    setIsTyping(false);
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 flex flex-col h-[500px] overflow-hidden">
      <div className="bg-red-500 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="font-bold">BloodLine AI Assistant</span>
        </div>
        <button 
          onClick={() => setMessages([])} 
          className="text-red-100 hover:text-white text-sm"
        >
          Clear
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-10">
            <p>Ask me anything about your donors!</p>
            <p className="text-xs mt-2">Example: "Who can donate to O+?" or "Give me a summary of my B+ donors"</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-3 rounded-2xl text-sm shadow-sm ${
              m.role === 'user' 
                ? 'bg-red-500 text-white rounded-tr-none' 
                : 'bg-white text-gray-800 border border-gray-200 rounded-tl-none'
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 p-3 rounded-2xl rounded-tl-none text-xs text-gray-400 animate-pulse">
              Gemini is thinking...
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSend} className="p-3 border-t bg-white flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your question..."
          className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
        />
        <button
          type="submit"
          disabled={isTyping}
          className="bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors disabled:opacity-50"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </form>
    </div>
  );
};

export default Assistant;
