'use client'

import { motion } from 'framer-motion'
import { ArrowLeft, Radio, Zap, Settings, Code2, Shield, Globe, BookOpen, CheckCircle, Copy, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import Link from 'next/link'
import { useState } from 'react'

const fadeIn = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } }

function CodeBlock({ code, language = 'json' }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="relative group">
      <pre className="bg-gray-950 text-gray-300 rounded-xl p-4 overflow-x-auto text-sm font-mono border border-gray-800">
        <code>{code}</code>
      </pre>
      <button
        onClick={copy}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white p-1.5 rounded-lg"
      >
        {copied ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  )
}

export default function ContentPublisherDocsPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white">
      {/* Header */}
      <div className="border-b border-gray-800 bg-[#0A0A0A]/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Volver</span>
          </Link>
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-sky-400" />
            <span className="font-bold text-lg">Content Publisher</span>
          </div>
          <Link href="/login">
            <Button size="sm" className="bg-sky-500 hover:bg-sky-600 text-white text-xs">
              Iniciar Sesión
            </Button>
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12 space-y-12">
        {/* Hero */}
        <motion.div {...fadeIn} className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 bg-sky-500/10 border border-sky-500/20 rounded-full px-4 py-1.5 text-sky-400 text-sm">
            <Radio className="w-4 h-4" />
            Skill de Plataforma
          </div>
          <h1 className="text-4xl md:text-5xl font-bold">
            Content Publisher
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Publica contenido generado por IA directamente a tu blog o CMS vía API REST. Multi-tenant, universal, zero-config.
          </p>
        </motion.div>

        {/* How it works */}
        <motion.div {...fadeIn} transition={{ delay: 0.1 }}>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Zap className="w-6 h-6 text-amber-400" />
            ¿Cómo funciona?
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { step: '1', title: 'Configura tu Endpoint', desc: 'En API Hub, conecta tu endpoint REST (Supabase, WordPress, Strapi, custom webhook...)', icon: Settings },
              { step: '2', title: 'Publica contenido', desc: 'Desde el Dashboard, JARVIS, o tu agente AI — envía contenido con un click o automáticamente', icon: Radio },
              { step: '3', title: 'Monitorea en tiempo real', desc: 'Ve cada publicación en el widget del Dashboard con status, duración y URL del post', icon: Globe },
            ].map((item) => (
              <Card key={item.step} className="bg-gray-900/50 border-gray-800 p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/20 flex items-center justify-center text-sky-400 font-bold text-sm">
                    {item.step}
                  </div>
                  <h3 className="font-semibold text-white">{item.title}</h3>
                </div>
                <p className="text-sm text-gray-400">{item.desc}</p>
              </Card>
            ))}
          </div>
        </motion.div>

        {/* Setup Guide */}
        <motion.div {...fadeIn} transition={{ delay: 0.2 }}>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Settings className="w-6 h-6 text-emerald-400" />
            Guía de Configuración
          </h2>
          <div className="space-y-6">
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-sky-400">Paso 1: Ir a API Hub</h3>
              <p className="text-gray-400">
                Navega a <code className="bg-gray-800 px-2 py-0.5 rounded text-sky-300">/dashboard/api-hub</code> y busca la tarjeta <strong>📡 Content Publisher</strong>.
              </p>
            </div>
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-sky-400">Paso 2: Configura los campos</h3>
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 space-y-3">
                <div>
                  <span className="text-sm font-medium text-white">Endpoint URL</span>
                  <span className="text-red-400 ml-1">*</span>
                  <p className="text-xs text-gray-500 mt-1">La URL donde se enviarán los POST con el contenido. Ejemplo:</p>
                  <code className="text-xs bg-gray-800 px-2 py-1 rounded text-emerald-300 block mt-1">
                    https://your-project.supabase.co/functions/v1/blog-auto-publish
                  </code>
                </div>
                <div>
                  <span className="text-sm font-medium text-white">API Key (Bearer Token)</span>
                  <span className="text-red-400 ml-1">*</span>
                  <p className="text-xs text-gray-500 mt-1">Tu token de autenticación. Se enviará como <code className="bg-gray-800 px-1 rounded">Authorization: Bearer [token]</code></p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-sky-400">Paso 3: ¡Publica!</h3>
              <p className="text-gray-400">
                Usa el widget <strong>Content Publisher</strong> en el Dashboard, el botón <strong>"Publicar Ahora"</strong>, o pídele a JARVIS: <em>"publica este artículo en mi blog"</em>.
              </p>
            </div>
          </div>
        </motion.div>

        {/* API Reference */}
        <motion.div {...fadeIn} transition={{ delay: 0.3 }}>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Code2 className="w-6 h-6 text-purple-400" />
            Referencia de API
          </h2>

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">POST /api/skills/content-publish</h3>
              <p className="text-gray-400 mb-3">Publica contenido al endpoint configurado del usuario.</p>
              <h4 className="text-sm font-medium text-gray-300 mb-2">Request Body:</h4>
              <CodeBlock code={`{
  "title": "Mi Artículo AI",
  "content": "<p>Contenido HTML del artículo...</p>",
  "slug": "mi-articulo-ai",        // opcional, se auto-genera
  "contentType": "blog_post",       // opcional, default: blog_post
  "agentId": "vera",               // opcional, identifica el agente
  "metadata": {                     // opcional
    "authType": "bearer",           // bearer | apikey | basic | custom_header
    "publishStatus": "published",
    "extraFields": {                // campos adicionales para tu API
      "category": "tech",
      "author": "VERA"
    }
  }
}`} />

              <h4 className="text-sm font-medium text-gray-300 mb-2 mt-4">Response (Success):</h4>
              <CodeBlock code={`{
  "success": true,
  "logId": "clxx...",
  "publishedUrl": "https://wildverse.blog/mi-articulo-ai",
  "status": "published",
  "duration": 342,
  "message": "\"Mi Artículo AI\" publicado exitosamente"
}`} />
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-3">GET /api/skills/content-publish</h3>
              <p className="text-gray-400 mb-3">Obtiene los logs de publicación del usuario.</p>
              <h4 className="text-sm font-medium text-gray-300 mb-2">Query Params:</h4>
              <CodeBlock code={`?limit=20         // max 100
&status=published  // published | error | publishing
&cursor=clxx...    // para paginación`} />

              <h4 className="text-sm font-medium text-gray-300 mb-2 mt-4">Response:</h4>
              <CodeBlock code={`{
  "logs": [...],
  "hasMore": false,
  "stats": { "total": 42, "published": 38, "errors": 4 },
  "configured": true,
  "endpoint": {
    "baseUrl": "https://...",
    "status": "active",
    "usageCount": 42
  }
}`} />
            </div>
          </div>
        </motion.div>

        {/* Webhook Payload */}
        <motion.div {...fadeIn} transition={{ delay: 0.35 }}>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Globe className="w-6 h-6 text-sky-400" />
            Lo que recibe tu endpoint
          </h2>
          <p className="text-gray-400 mb-4">
            Cuando publicas, tu endpoint recibe un POST con estos headers y body:
          </p>
          <h4 className="text-sm font-medium text-gray-300 mb-2">Headers:</h4>
          <CodeBlock code={`Authorization: Bearer [tu-api-key]
Content-Type: application/json
x-real-source: octopus-content-publisher`} />

          <h4 className="text-sm font-medium text-gray-300 mb-2 mt-4">Body (default field mapping):</h4>
          <CodeBlock code={`{
  "title": "Mi Artículo AI",
  "content": "<p>Contenido del artículo...</p>",
  "slug": "mi-articulo-ai",
  "status": "published"
}`} />

          <div className="mt-4 bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
            <p className="text-sm text-amber-300">
              <strong>💡 Tip:</strong> Puedes personalizar el field mapping almacenando un JSON en el nombre del servicio.
              El formato es: <code className="bg-gray-800 px-1 rounded">{'{"fieldMapping": {"title": "post_title", "content": "body"}}'}</code>
            </p>
          </div>
        </motion.div>

        {/* Dino-SEO Standard */}
        <motion.div {...fadeIn} transition={{ delay: 0.37 }}>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-lime-400" />
            Estándar Dino-SEO
          </h2>
          <p className="text-gray-400 mb-4">
            Todo contenido publicado a través del Content Publisher debe cumplir con las <strong className="text-white">Dino-SEO Rules</strong> de Wildverse.
            Estas reglas están hardcodeadas en el system prompt de VERA y todos los agentes.
          </p>
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-gray-900/50 border border-gray-800/50">
              <h3 className="text-lg font-semibold text-white mb-3">🔑 1. Título con Keyword</h3>
              <p className="text-sm text-gray-400">Debe incluir al menos un keyword de alto volumen de búsqueda en los primeros 60 caracteres.</p>
              <div className="mt-2 space-y-1">
                <p className="text-xs text-emerald-400">✅ &quot;Hidden Sugars in Food: What You Need to Know&quot;</p>
                <p className="text-xs text-emerald-400">✅ &quot;Ultra-Processed Ingredients: The Complete Guide&quot;</p>
                <p className="text-xs text-red-400">❌ &quot;My New Post&quot;, &quot;Test Article&quot;</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-gray-900/50 border border-gray-800/50">
              <h3 className="text-lg font-semibold text-white mb-3">📐 2. Estructura Obligatoria</h3>
              <div className="space-y-2 text-sm text-gray-400">
                <p><strong className="text-sky-400">H2: ¿Qué es [tema]?</strong> — Definición clara, 2-3 párrafos con contexto científico</p>
                <p><strong className="text-sky-400">H2: Lista de alta densidad</strong> — Top 10, ingredientes, datos clave (5-8 items con &lt;ul&gt;/&lt;ol&gt;)</p>
                <p><strong className="text-sky-400">H2: FAQ</strong> — Mínimo 3 preguntas reales de Google con respuestas de 50+ palabras</p>
                <p><strong className="text-sky-400">H2: Dino Insights</strong> — Análisis técnico/profesional de cierre</p>
                <p><strong className="text-lime-400">CTA Final</strong> — Bloque &quot;Escanea con Wildverse&quot; con icono 🦖 (siempre incluido)</p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-gray-900/50 border border-gray-800/50">
              <h3 className="text-lg font-semibold text-white mb-3">🎨 3. Tono &quot;Dino&quot;</h3>
              <p className="text-sm text-gray-400">Profesional pero con personalidad — técnico pero accesible. Datos y cifras siempre que sea posible.</p>
            </div>

            <div className="p-4 rounded-xl bg-gray-900/50 border border-gray-800/50">
              <h3 className="text-lg font-semibold text-white mb-3">✅ 4. Calidad</h3>
              <p className="text-sm text-gray-400">Cero errores tipográficos. HTML bien formado. Mínimo 800 palabras totales, 100+ por sección H2.</p>
            </div>
          </div>
        </motion.div>

        {/* Supported Platforms */}
        <motion.div {...fadeIn} transition={{ delay: 0.4 }}>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Shield className="w-6 h-6 text-emerald-400" />
            Plataformas Compatibles
          </h2>
          <div className="grid md:grid-cols-2 gap-3">
            {[
              { name: 'Supabase Edge Functions', desc: 'POST a tu función serverless con Bearer auth' },
              { name: 'WordPress REST API', desc: 'Endpoint /wp-json/wp/v2/posts con Application Password' },
              { name: 'Strapi CMS', desc: 'API REST nativa con JWT token' },
              { name: 'Ghost CMS', desc: 'Admin API con Content API key' },
              { name: 'Webhook personalizado', desc: 'Cualquier URL que acepte POST + JSON' },
              { name: 'Notion API', desc: 'Crea páginas en tu database de Notion' },
              { name: 'Contentful', desc: 'Content Management API con Bearer token' },
              { name: 'Sanity.io', desc: 'Mutations API con token de escritura' },
            ].map((platform) => (
              <div key={platform.name} className="flex items-start gap-3 p-3 rounded-lg bg-gray-900/30 border border-gray-800/50">
                <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-white">{platform.name}</p>
                  <p className="text-xs text-gray-500">{platform.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* JARVIS Integration */}
        <motion.div {...fadeIn} transition={{ delay: 0.45 }}>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-amber-400" />
            Integración con JARVIS
          </h2>
          <p className="text-gray-400 mb-4">
            JARVIS (OCTOPUS AI) puede publicar contenido por ti con lenguaje natural:
          </p>
          <div className="space-y-3">
            {[
              '"Publica este artículo en mi blog"',
              '"Manda al blog: Título — 5 tendencias de AI en 2026"',
              '"Publish this to my CMS"',
            ].map((cmd) => (
              <div key={cmd} className="bg-gray-900/50 border border-gray-800 rounded-lg p-3 font-mono text-sm text-sky-300">
                {cmd}
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-3">
            JARVIS genera el JSON de acción <code className="bg-gray-800 px-1 rounded">content_publish</code> y ejecuta el POST automáticamente.
          </p>
        </motion.div>

        {/* Footer */}
        <div className="border-t border-gray-800 pt-8 pb-12 text-center">
          <p className="text-gray-500 text-sm">
            Content Publisher es un Skill nativo de la plataforma Octopus.
          </p>
          <div className="flex justify-center gap-4 mt-4">
            <Link href="/dashboard/api-hub">
              <Button size="sm" variant="ghost" className="text-sky-400 hover:text-sky-300">
                <Settings className="w-4 h-4 mr-1" />
                Configurar en API Hub
              </Button>
            </Link>
            <Link href="/dashboard/skill-factory">
              <Button size="sm" variant="ghost" className="text-purple-400 hover:text-purple-300">
                <Zap className="w-4 h-4 mr-1" />
                Skill Factory
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
