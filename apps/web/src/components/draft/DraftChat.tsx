'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageCircle, 
  Send, 
  Smile, 
  Users,
  Minimize2,
  Maximize2,
  Settings
} from 'lucide-react';
import { DraftChatMessage } from '@/lib/hooks/useDraftWebSocket';

interface DraftChatProps {
  messages: DraftChatMessage[];
  onSendMessage: (message: string, emoji?: string) => void;
  participants: any[];
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
  className?: string;
}

const EMOJI_LIST = [
  '👍', '👎', '😂', '😢', '😮', '😡', '🔥', '💯', 
  '🎯', '💪', '🤔', '😎', '🤡', '👀', '💰', '📈'
];

const QUICK_MESSAGES = [
  'Nice pick!',
  'Surprised by that one',
  'Great value!',
  'Risky choice...',
  'Steal of the draft!',
  'Too early IMO',
  'Smart move',
  'Bold strategy'
];

export function DraftChat({ 
  messages, 
  onSendMessage, 
  participants,
  isMinimized = false,
  onToggleMinimize,
  className = '' 
}: DraftChatProps) {
  const [newMessage, setNewMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showQuickMessages, setShowQuickMessages] = useState(false);
  const [selectedEmoji, setSelectedEmoji] = useState<string>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when not minimized
  useEffect(() => {
    if (!isMinimized && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isMinimized]);

  const handleSendMessage = () => {
    if (newMessage.trim()) {
      onSendMessage(newMessage.trim(), selectedEmoji);
      setNewMessage('');
      setSelectedEmoji(undefined);
      setShowEmojiPicker(false);
      setShowQuickMessages(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleQuickMessage = (message: string) => {
    onSendMessage(message);
    setShowQuickMessages(false);
  };

  const handleEmojiSelect = (emoji: string) => {
    setSelectedEmoji(emoji);
    setShowEmojiPicker(false);
  };

  const formatTime = (timestamp: Date) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getUserColor = (userId: string) => {
    const colors = [
      'text-blue-400',
      'text-green-400',
      'text-purple-400',
      'text-orange-400',
      'text-pink-400',
      'text-cyan-400',
      'text-yellow-400',
      'text-red-400'
    ];
    const index = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[index % colors.length];
  };

  if (isMinimized) {
    return (
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`glass-card p-3 ${className}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium">Draft Chat</span>
            {messages.length > 0 && (
              <span className="bg-blue-500 text-xs px-2 py-0.5 rounded-full">
                {messages.length}
              </span>
            )}
          </div>
          <button
            onClick={onToggleMinimize}
            className="p-1 hover:bg-white/10 rounded transition-colors"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className={`glass-card p-4 flex flex-col h-96 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-blue-400" />
          <h3 className="font-semibold">Draft Chat</h3>
          <span className="text-xs text-gray-400">
            ({participants.filter(p => p.isOnline).length} online)
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowQuickMessages(!showQuickMessages)}
            className="p-1 hover:bg-white/10 rounded transition-colors"
            title="Quick messages"
          >
            <Settings className="w-4 h-4 text-gray-400" />
          </button>
          {onToggleMinimize && (
            <button
              onClick={onToggleMinimize}
              className="p-1 hover:bg-white/10 rounded transition-colors"
            >
              <Minimize2 className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-2 mb-3">
        <AnimatePresence initial={false}>
          {messages.map((message, index) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="flex gap-2 text-sm"
            >
              <div className="flex-shrink-0">
                <div className={`font-medium ${getUserColor(message.userId)}`}>
                  {message.username}:
                </div>
                <div className="text-xs text-gray-500">
                  {formatTime(message.timestamp)}
                </div>
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {message.emoji && (
                    <span className="text-lg">{message.emoji}</span>
                  )}
                  <span className="text-gray-300">{message.message}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {messages.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No messages yet</p>
            <p className="text-xs">Start the conversation!</p>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Messages */}
      <AnimatePresence>
        {showQuickMessages && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-3 p-3 bg-white/5 rounded-lg border border-white/10"
          >
            <div className="text-xs text-gray-400 mb-2">Quick messages:</div>
            <div className="grid grid-cols-2 gap-1">
              {QUICK_MESSAGES.map((msg, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickMessage(msg)}
                  className="text-xs p-1 hover:bg-white/10 rounded text-left transition-colors"
                >
                  {msg}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="space-y-2">
        {/* Emoji Picker */}
        <AnimatePresence>
          {showEmojiPicker && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="p-3 bg-white/5 rounded-lg border border-white/10"
            >
              <div className="text-xs text-gray-400 mb-2">Select emoji:</div>
              <div className="grid grid-cols-8 gap-1">
                {EMOJI_LIST.map((emoji, index) => (
                  <button
                    key={index}
                    onClick={() => handleEmojiSelect(emoji)}
                    className={`text-lg p-1 hover:bg-white/10 rounded transition-colors ${
                      selectedEmoji === emoji ? 'bg-white/20' : ''
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Message Input */}
        <div className="flex gap-2">
          <div className="flex items-center">
            {selectedEmoji && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="text-lg mr-2 p-1 bg-white/10 rounded"
              >
                {selectedEmoji}
              </motion.span>
            )}
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={`p-2 hover:bg-white/10 rounded transition-colors ${
                showEmojiPicker ? 'bg-white/20' : ''
              }`}
            >
              <Smile className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1 input-field text-sm"
            maxLength={200}
          />
          
          <button
            onClick={handleSendMessage}
            disabled={!newMessage.trim()}
            className="btn-primary px-3 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        
        <div className="text-xs text-gray-500 text-center">
          {newMessage.length}/200 • Press Enter to send
        </div>
      </div>
    </div>
  );
}