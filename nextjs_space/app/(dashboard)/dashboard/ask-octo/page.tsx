'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSession } from 'next-auth/react'
import { usePathname } from 'next/navigation'
import {
  MessageCircleQuestion,
  Send,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  Bot,
  User,
  RefreshCw,
  Lightbulb,
  Zap,
  HelpCircle,
  BookOpen,
  ArrowRight,
  Mic,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/lib/i18n-context'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  helpful?: boolean | null
}

// Bilingual quick questions
const QUICK_QUESTIONS = {
  es: [
    { icon: '🎬', text: '¿Cómo genero un video UGC?' },
    { icon: '📱', text: '¿Cómo publico en LinkedIn?' },
    { icon: '🤖', text: '¿Qué puede hacer Jarvis?' },
    { icon: '📅', text: '¿Cómo programo posts?' },
  ],
  en: [
    { icon: '🎬', text: 'How do I generate a UGC video?' },
    { icon: '📱', text: 'How do I post on LinkedIn?' },
    { icon: '🤖', text: 'What can Jarvis do?' },
    { icon: '📅', text: 'How do I schedule posts?' },
  ]
}

// Bilingual tips
const MODULE_TIPS: Record<string, { es: { title: string; tips: string[] }; en: { title: string; tips: string[] } }> = {
  jarvis: {
    es: {
      title: 'Tips para OCTOPUS (Jarvis)',
      tips: [
        'Usa comandos naturales: "Genera una imagen de..."',
        'Para videos: "Genera un video UGC sobre..."',
        'Programa posts: "Programa este video para las 5pm"',
      ]
    },
    en: {
      title: 'Tips for OCTOPUS (Jarvis)',
      tips: [
        'Use natural commands: "Generate an image of..."',
        'For videos: "Generate a UGC video about..."',
        'Schedule posts: "Schedule this video for 5pm"',
      ]
    }
  },
  'social-bridge': {
    es: {
      title: 'Tips para Social Bridge',
      tips: [
        'Conecta LinkedIn primero (botón verde)',
        'Puedes publicar texto, imágenes o videos',
        'Programa posts desde aquí o desde Jarvis',
      ]
    },
    en: {
      title: 'Tips for Social Bridge',
      tips: [
        'Connect LinkedIn first (green button)',
        'You can post text, images or videos',
        'Schedule posts from here or from Jarvis',
      ]
    }
  },
  default: {
    es: {
      title: 'Bienvenido a OCTOPUS',
      tips: [
        'Explora los módulos en el menú lateral',
        'Jarvis es tu asistente principal',
        'Pregunta lo que necesites, estoy aquí para ayudar',
      ]
    },
    en: {
      title: 'Welcome to OCTOPUS',
      tips: [
        'Explore modules in the sidebar',
        'Jarvis is your main assistant',
        'Ask anything you need, I\'m here to help',
      ]
    }
  }
}

export default function AskOctoPage() {
  const { data: session } = useSession() || {}
  const pathname = usePathname()
  const { locale: language } = useI18n()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  
  const lang = language as 'es' | 'en'
  const firstName = session?.user?.name?.split(' ')[0] || 'User'

  // Detect current module from URL
  const getCurrentModule = useCallback(() => {
    if (pathname?.includes('jarvis')) return 'jarvis'
    if (pathname?.includes('social-bridge')) return 'social-bridge'
    if (pathname?.includes('ugc-factory')) return 'ugc-factory'
    if (pathname?.includes('chat')) return 'chat'
    if (pathname?.includes('growth')) return 'growth'
    if (pathname?.includes('ad-factory')) return 'ad-factory'
    return 'default'
  }, [pathname])

  const currentModule = getCurrentModule()
  const moduleTips = MODULE_TIPS[currentModule] || MODULE_TIPS.default
  const tips = moduleTips[lang]
  const questions = QUICK_QUESTIONS[lang]
  
  // Translations
  const texts = {
    title: lang === 'es' ? 'ASK Octo AI' : 'ASK Octo AI',
    badge: lang === 'es' ? '🐙 Tu Guía Inteligente' : '🐙 Your Smart Guide',
    subtitle: lang === 'es' ? 'Pregúntame cualquier cosa sobre OCTOPUS. Estoy aquí para ayudarte.' : 'Ask me anything about OCTOPUS. I\'m here to help.',
    greeting: lang === 'es' ? `¡Hola, ${firstName}!` : `Hello, ${firstName}!`,
    greetingSub: lang === 'es' ? 'Soy tu guía personal de OCTOPUS. Puedo ayudarte a entender cómo usar cada módulo, resolver dudas y darte recomendaciones.' : 'I\'m your personal OCTOPUS guide. I can help you understand how to use each module, resolve questions and give you recommendations.',
    placeholder: lang === 'es' ? 'Escribe tu pregunta...' : 'Type your question...',
    thinking: lang === 'es' ? 'Pensando...' : 'Thinking...',
    helpful: lang === 'es' ? '¿Te ayudó?' : 'Was this helpful?',
    quickLinks: lang === 'es' ? 'Accesos Rápidos' : 'Quick Links',
    goToJarvis: lang === 'es' ? 'Ir a OCTOPUS (Jarvis)' : 'Go to OCTOPUS (Jarvis)',
    goToSocial: lang === 'es' ? 'Ir a Social Bridge' : 'Go to Social Bridge',
    goToStudio: lang === 'es' ? 'Ir a Estudio Creativo' : 'Go to Creative Studio',
    tipNote: lang === 'es' ? 'Puedo recordar el contexto de nuestra conversación, así que no dudes en hacer preguntas de seguimiento.' : 'I can remember our conversation context, so feel free to ask follow-up questions.',
    errorMsg: lang === 'es' ? 'Lo siento, hubo un error al procesar tu consulta. Por favor inténtalo de nuevo.' : 'Sorry, there was an error processing your query. Please try again.',
    disclaimer: lang === 'es' ? 'Octo puede cometer errores. Verifica las respuestas.' : 'Octo can make mistakes. Double-check replies.',
  }

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input on load
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim()
    if (!messageText || isLoading) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageText,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/octo-guide/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          currentPage: pathname,
          currentModule,
          sessionId,
          language: lang
        })
      })

      const data = await response.json()

      if (data.success) {
        setSessionId(data.sessionId)
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: data.message,
          timestamp: new Date()
        }
        setMessages(prev => [...prev, assistantMessage])
      } else {
        throw new Error(data.error || 'Unknown error')
      }
    } catch (error) {
      console.error('Error:', error)
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: texts.errorMsg,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleFeedback = async (messageId: string, helpful: boolean) => {
    setMessages(prev => prev.map(m => 
      m.id === messageId ? { ...m, helpful } : m
    ))

    try {
      await fetch('/api/octo-guide/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, helpful })
      })
    } catch (error) {
      console.error('Feedback error:', error)
    }
  }

  const clearChat = () => {
    setMessages([])
    setSessionId(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0C1222] via-[#1a2744] to-[#0C1222] p-4 md:p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-[#673de6]/20 to-[#a855f7]/20 border border-[#673de6]/30">
            <MessageCircleQuestion className="w-8 h-8 text-[#673de6]" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-white flex items-center gap-2">
              {texts.title}
              <span className="text-xs px-2 py-1 rounded-full bg-[#673de6]/20 text-[#a855f7] font-medium">
                {texts.badge}
              </span>
            </h1>
            <p className="text-gray-400 text-sm mt-1">
              {texts.subtitle}
            </p>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Main Chat Area */}
        <div className="lg:col-span-3">
          <Card className="bg-white/5 dark:bg-[#1a2744]/80 border-gray-200 dark:border-white/10 backdrop-blur-xl overflow-hidden">
            {/* Messages */}
            <div className="h-[500px] overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6">
                  <div className="p-4 rounded-full bg-gradient-to-br from-[#673de6]/20 to-[#a855f7]/20 mb-4">
                    <span className="text-4xl">🐙</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{texts.greeting} 👋</h3>
                  <p className="text-gray-500 dark:text-gray-400 max-w-md mb-6">
                    {texts.greetingSub}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                    {questions.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(q.text)}
                        className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 hover:border-[#673de6] transition-all text-left text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white group"
                      >
                        <span className="text-lg">{q.icon}</span>
                        <span className="flex-1">{q.text}</span>
                        <ArrowRight className="w-4 h-4 text-gray-400 dark:text-white/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <AnimatePresence>
                    {messages.map((msg) => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        {msg.role === 'assistant' && (
                          <div className="p-2 rounded-xl bg-[#673de6]/20 h-fit">
                            <span className="text-lg">🐙</span>
                          </div>
                        )}
                        <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-first' : ''}`}>
                          <div
                            className={`p-4 rounded-2xl ${
                              msg.role === 'user'
                                ? 'bg-[#673de6] text-white'
                                : 'bg-gray-100 dark:bg-white/5 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-white/10'
                            }`}
                          >
                            <div className="whitespace-pre-wrap text-sm leading-relaxed">
                              {msg.content}
                            </div>
                          </div>
                          {msg.role === 'assistant' && (
                            <div className="flex items-center gap-2 mt-2 ml-2">
                              <span className="text-xs text-gray-500">{texts.helpful}</span>
                              <button
                                onClick={() => handleFeedback(msg.id, true)}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  msg.helpful === true
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : 'hover:bg-white/5 text-gray-500 hover:text-emerald-400'
                                }`}
                              >
                                <ThumbsUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleFeedback(msg.id, false)}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  msg.helpful === false
                                    ? 'bg-red-500/20 text-red-400'
                                    : 'hover:bg-white/5 text-gray-500 hover:text-red-400'
                                }`}
                              >
                                <ThumbsDown className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                        {msg.role === 'user' && (
                          <div className="p-2 rounded-xl bg-[#673de6]/20 h-fit">
                            <User className="w-5 h-5 text-[#673de6]" />
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {isLoading && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex gap-3"
                    >
                      <div className="p-2 rounded-xl bg-[#673de6]/20">
                        <span className="text-lg">🐙</span>
                      </div>
                      <div className="p-4 rounded-2xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10">
                        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                          <div className="flex gap-1">
                            <span className="w-2 h-2 bg-[#673de6] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-2 h-2 bg-[#673de6] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-2 h-2 bg-[#673de6] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                          </div>
                          <span className="text-sm">{texts.thinking}</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-200 dark:border-white/10 bg-white/50 dark:bg-[#0C1222]/50">
              <div className="flex items-center gap-2 bg-gray-100 dark:bg-white/5 rounded-full px-4 py-2 border border-gray-200 dark:border-white/10 focus-within:border-[#673de6] transition-colors">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder={texts.placeholder}
                  className="flex-1 bg-transparent text-gray-800 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none"
                  disabled={isLoading}
                />
                <button className="p-1.5 text-gray-400 dark:text-white/40 hover:text-[#673de6] transition-colors">
                  <Mic className="w-4 h-4" />
                </button>
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || isLoading}
                  className="p-2 bg-[#673de6] hover:bg-[#5025d1] disabled:opacity-50 disabled:cursor-not-allowed rounded-full transition-colors"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <Send className="w-4 h-4 text-white" />
                  )}
                </button>
                {messages.length > 0 && (
                  <button
                    onClick={clearChat}
                    className="p-2 text-gray-400 hover:text-[#673de6] transition-colors"
                    title={lang === 'es' ? 'Nueva conversación' : 'New conversation'}
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="text-[10px] text-center text-gray-400 dark:text-white/30 mt-2">
                {texts.disclaimer}
              </p>
            </div>
          </Card>
        </div>

        {/* Sidebar - Tips & Quick Access */}
        <div className="space-y-4">
          {/* Contextual Tips */}
          <Card className="p-4 bg-white/80 dark:bg-[#1a2744]/80 border-gray-200 dark:border-white/10 backdrop-blur-xl">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-5 h-5 text-[#673de6]" />
              <h3 className="font-bold text-gray-900 dark:text-white">{tips.title}</h3>
            </div>
            <ul className="space-y-2">
              {tips.tips.map((tip, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <ArrowRight className="w-4 h-4 text-[#673de6] mt-0.5 flex-shrink-0" />
                  {tip}
                </li>
              ))}
            </ul>
          </Card>

          {/* Quick Links */}
          <Card className="p-4 bg-white/80 dark:bg-[#1a2744]/80 border-gray-200 dark:border-white/10 backdrop-blur-xl">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-5 h-5 text-[#a855f7]" />
              <h3 className="font-bold text-gray-900 dark:text-white">{texts.quickLinks}</h3>
            </div>
            <div className="space-y-2">
              <a href="/dashboard/jarvis" className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors text-sm">
                <Bot className="w-4 h-4 text-[#673de6]" />
                {texts.goToJarvis}
              </a>
              <a href="/dashboard/social-bridge" className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors text-sm">
                <Sparkles className="w-4 h-4 text-[#0A66C2]" />
                {texts.goToSocial}
              </a>
              <a href="/dashboard/chat" className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors text-sm">
                <Zap className="w-4 h-4 text-emerald-400" />
                {texts.goToStudio}
              </a>
            </div>
          </Card>

          {/* Help Note */}
          <Card className="p-4 bg-gradient-to-br from-[#673de6]/10 to-[#a855f7]/10 border-[#673de6]/20">
            <div className="flex items-start gap-3">
              <HelpCircle className="w-5 h-5 text-[#673de6] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  <span className="font-bold text-[#673de6]">Tip:</span> {texts.tipNote}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
