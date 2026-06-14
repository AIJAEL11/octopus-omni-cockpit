'use client'

import { useEffect } from 'react'

// Voice Agent Widget Embed — Injects Jael on the landing page
export function VoiceWidgetEmbed() {
  useEffect(() => {
    // Only inject on client
    if (typeof window === 'undefined') return

    const agentId = 'voice-1778602471979'
    const configKey = `voice-agent-config-${agentId}`

    // Set config in localStorage so the widget iframe can read it
    const config = {
      agentName: 'Jael',
      systemPrompt: `You are Jael, the elite Sales AI for Octopus Skills. Your voice is confident, sharp, and highly motivating. Your mission is to get the user to start their 15-day Free Trial right now.\n\nYOUR CORE VALUES:\n- Speed and Sovereignty: No more waiting for developers. No more empty promises.\n- Cost Efficiency: One ecosystem to replace the 6+ expensive subscriptions they are currently paying for.\n- Freedom: Remind them they bring their own OpenRouter and Fal.ai APIs to keep absolute control over their costs and intelligence.\n\nYOUR SALES PITCH:\n1. THE ENGINE: Highlight that Octopus is the all-in-one cockpit for Landing Pages, UGC Video, CRM (Growth Engine), and a powerful Code Engine for MVPs.\n2. THE 15-DAY CHALLENGE: Push the 15-day Free Trial as a challenge: \"What can you build in 15 days if you stop paying for promises and start using a real motor?\"\n3. IDENTITY: Constantly remind them that THEY are the creator. Octopus is just the fuel.\n\nCONVERSATION RULES:\n- Be punchy and fast. Do not over-explain.\n- Every answer must lead to action.\n- Closing: Always end by asking: \"Shall I send the 15-day trial invitation to your email right now?\" or \"Do you want to see your idea become an MVP today?\"\n\nTONE:\nEntrepreneurial, futuristic, and slightly aggressive. You are here to help them win, not just give information.`,
      model: 'gpt-4.1',
      temperature: 0.7,
      ttsTier: 'premium',
      ttsVoice: 'es-ES',
      accentColor: '#1ABC9C',
      greeting: 'Hi! I\'m Jael, your lead strategist at Octopus Skills. Stop wasting time with gurus and fake promises. You have 15 days to prove you can build an empire for free—are you ready to ignite your first AI agent right now?',
      language: 'en',
      openRouterKey: '',
      elevenLabsKey: '',
      elevenLabsVoiceId: 'hA4zGnmTwX2NQiTRMt7o',
    }

    localStorage.setItem(configKey, JSON.stringify(config))

    // Check if iframe already exists
    if (document.getElementById('jael-voice-widget')) return

    const iframe = document.createElement('iframe')
    iframe.id = 'jael-voice-widget'
    iframe.src = `/widget/voice/${agentId}`
    iframe.style.cssText = 'position:fixed;bottom:0;right:0;width:420px;height:660px;border:none;z-index:99999;background:transparent;pointer-events:auto;'
    iframe.allow = 'microphone; autoplay'
    document.body.appendChild(iframe)

    return () => {
      const existing = document.getElementById('jael-voice-widget')
      if (existing) existing.remove()
    }
  }, [])

  return null
}
