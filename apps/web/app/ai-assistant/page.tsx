'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { apiClient } from '@/lib/api/client'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  error?: boolean
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
      content: "Hey! I'm your Fantasy AI assistant powered by Claude 3 Opus. I can help you analyze patterns, find betting opportunities, and answer questions about your leagues. What would you like to know?",
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

    try {
      // Call the real AI API
      const response = await apiClient.chat(
        messages.concat(userMessage).map(m => ({
          role: m.role,
          content: m.content
        }))
      )

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
        error: response.error
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('AI chat error:', error)
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm having trouble connecting to the AI service. Please make sure the server is running and try again.",
        timestamp: new Date(),
        error: true
      }
      
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsTyping(false)
    }
  }

  const handleVoiceInput = async () => {
    if (!isListening) {
      // Check if browser supports speech recognition
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      
      if (!SpeechRecognition) {
        alert('Speech recognition is not supported in your browser. Try Chrome or Edge.')
        return
      }

      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = 'en-US'

      recognition.onstart = () => {
        setIsListening(true)
      }

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript
        setInput(transcript)
        setIsListening(false)
      }

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error)
        setIsListening(false)
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognition.start()
    }
  }

  const handleSuggestionClick = (prompt: string) => {
    setInput(prompt)
    inputRef.current?.focus()
  }

  return (
    <div className="min-h-screen bg-black p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold text-white">AI Assistant</h1>
          <span className="text-sm text-gray-400">
            Powered by Claude 3 Opus
          </span>
        </div>

        <Card className="glass-card border-white/10">
          <CardHeader>
            <CardTitle>Chat with Fantasy AI</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Suggestions */}
            <div className="flex flex-wrap gap-2">
              {suggestionPrompts.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestionClick(prompt)}
                  className="px-3 py-1 text-sm glass-card border-white/10 hover:border-white/20 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* Messages */}
            <div className="h-[500px] overflow-y-auto space-y-4 p-4 glass-morphism rounded-lg">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-4 rounded-lg ${
                      message.role === 'user'
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                        : message.error
                        ? 'glass-card border-red-500/50 text-red-200'
                        : 'glass-card border-white/10'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    <p className="text-xs opacity-50 mt-2">
                      {message.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="glass-card border-white/10 p-4 rounded-lg">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-white/50 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-white/50 rounded-full animate-bounce delay-100" />
                      <div className="w-2 h-2 bg-white/50 rounded-full animate-bounce delay-200" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
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