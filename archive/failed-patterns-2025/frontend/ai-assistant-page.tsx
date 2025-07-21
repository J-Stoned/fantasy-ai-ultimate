'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui'
import { Button } from '../../components/ui'
import { Input } from '../../components/ui'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const suggestionPrompts = [
  "What patterns are hot today?",
  "Show me the best ROI patterns",
  "Analyze Lakers vs Nuggets",
  "What's my profit this week?",
  "Find underdog opportunities",
  "Explain Back-to-Back Fade"
]

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hey! I'm your Fantasy AI assistant. I can help you analyze patterns, find betting opportunities, and answer questions about your leagues. What would you like to know?",
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async () => {
    if (!input.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsTyping(true)

    // Simulate AI response
    setTimeout(() => {
      const response = generateResponse(input)
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, assistantMessage])
      setIsTyping(false)
    }, 1000 + Math.random() * 1000)
  }

  const generateResponse = (query: string) => {
    const lowerQuery = query.toLowerCase()
    
    if (lowerQuery.includes('pattern') && lowerQuery.includes('hot')) {
      return "🔥 Today's hottest patterns:\n\n1. **Back-to-Back Fade** (76.8% accuracy) - 3 games tonight\n2. **Altitude Advantage** (68.3% accuracy) - Nuggets home game\n3. **Division Dog Bite** (58.6% accuracy) - 2 divisional matchups\n\nThe Back-to-Back Fade is especially strong tonight with Lakers playing their second road game in a row."
    }
    
    if (lowerQuery.includes('roi')) {
      return "💰 Top ROI patterns this week:\n\n1. **Back-to-Back Fade**: 46.6% ROI\n2. **Embarrassment Revenge**: 41.9% ROI\n3. **Altitude Advantage**: 36.3% ROI\n\nThese patterns have generated $127K in profit over the last 30 days. Want me to alert you when they trigger?"
    }
    
    if (lowerQuery.includes('lakers') || lowerQuery.includes('nuggets')) {
      return "🏀 **Lakers @ Nuggets Analysis**\n\n✅ Pattern Match: Back-to-Back Fade\n- Lakers on 2nd game of B2B ✓\n- Traveled 1,000+ miles ✓\n- Nuggets rested 2 days ✓\n\n📊 Prediction: Nuggets -7.5 (68% confidence)\n💡 Recommended: Bet Nuggets spread\n🎯 Historical: 14-4 in similar spots"
    }
    
    if (lowerQuery.includes('back-to-back') || lowerQuery.includes('fade')) {
      return "📚 **Back-to-Back Fade Pattern**\n\nThis pattern identifies when teams playing their second game in two nights are likely to underperform, especially on the road.\n\n**Key Factors:**\n- Team on 2nd game of back-to-back\n- Opponent well-rested (2+ days)\n- Travel distance > 500 miles\n- Game before 8 PM local time\n\n**Performance:** 76.8% accuracy over 8,234 games\n**Best Sport:** NBA Basketball"
    }
    
    return "I'm analyzing your question... Based on current patterns, I'd recommend checking the Pattern Dashboard for the latest opportunities. Is there something specific you'd like me to help you with?"
  }

  const handleVoiceInput = () => {
    if (!isListening) {
      // Start listening
      setIsListening(true)
      // In production, integrate with Web Speech API
      setTimeout(() => {
        setInput("What patterns are hot today?")
        setIsListening(false)
        inputRef.current?.focus()
      }, 2000)
    } else {
      setIsListening(false)
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion)
    inputRef.current?.focus()
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-lg border-b border-white/10 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">AI Assistant</h1>
            <p className="text-sm text-gray-400">Powered by Fantasy AI</p>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm text-gray-400">Online</span>
          </div>
        </div>
      </div>

      {/* Chat Container */}
      <div className="flex-1 max-w-4xl w-full mx-auto p-4 overflow-hidden flex flex-col">
        {/* Messages */}
        <Card className="flex-1 mb-4 overflow-hidden flex flex-col">
          <CardContent className="flex-1 overflow-y-auto p-6">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] ${
                      message.role === 'user'
                        ? 'bg-primary-500 text-white'
                        : 'glass-card'
                    } rounded-2xl px-4 py-3`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    <p className={`text-xs mt-1 ${
                      message.role === 'user' ? 'text-white/70' : 'text-gray-500'
                    }`}>
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              
              {isTyping && (
                <div className="flex justify-start">
                  <div className="glass-card rounded-2xl px-4 py-3">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          </CardContent>
        </Card>

        {/* Suggestions */}
        <div className="mb-4 overflow-x-auto">
          <div className="flex space-x-2 pb-2">
            {suggestionPrompts.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSuggestionClick(prompt)}
                className="flex-shrink-0 px-4 py-2 glass-card rounded-full text-sm text-gray-300 hover:text-white hover:border-white/20 transition-all"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        {/* Input Area */}
        <Card>
          <CardContent className="p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSend()
              }}
              className="flex items-center space-x-2"
            >
              <button
                type="button"
                onClick={handleVoiceInput}
                className={`p-3 rounded-lg transition-all ${
                  isListening 
                    ? 'bg-red-500 text-white animate-pulse' 
                    : 'glass-card hover:border-white/20 text-gray-400 hover:text-white'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>
              
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything about patterns, betting, or your leagues..."
                className="flex-1"
                disabled={isTyping}
              />
              
              <Button
                type="submit"
                disabled={!input.trim() || isTyping}
                className="px-6"
              >
                Send
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}