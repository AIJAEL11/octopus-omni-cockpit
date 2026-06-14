export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { callLLM } from '@/lib/turbo-llm'

// POST — execute a custom skill (real execution via LLM engine)
export async function POST(req: NextRequest) {
  const start = Date.now()
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { skillId, input } = await req.json()
    if (!skillId) return NextResponse.json({ error: 'skillId requerido' }, { status: 400 })

    const skill = await prisma.customSkill.findFirst({
      where: { id: skillId, userId: session.user.id },
    })
    if (!skill) return NextResponse.json({ error: 'Skill no encontrada' }, { status: 404 })
    if (skill.isActive === false) {
      return NextResponse.json({ error: 'Esta skill está desactivada. Actívala primero.' }, { status: 400 })
    }

    const systemPrompt = `Eres el Motor de Ejecución de Skills de OCTOPUS (la plataforma de Octopus Skills).
Tu trabajo es EJECUTAR la skill del usuario y producir el resultado real, útil y accionable.

SKILL A EJECUTAR:
- Nombre: ${skill.name}
- Descripción: ${skill.description || '(sin descripción)'}
- Categoría: ${skill.category}
${skill.code ? `- Lógica/Código de la skill:\n\`\`\`\n${skill.code.substring(0, 4000)}\n\`\`\`` : ''}

REGLAS:
1. Interpreta el propósito de la skill y ejecútala produciendo un RESULTADO REAL (no expliques cómo lo harías, hazlo).
2. Si la skill genera contenido (textos, emails, análisis, código, planes), entrega el contenido final completo.
3. Si el usuario dio un input, úsalo como parámetro principal de la ejecución.
4. Si no hay input y la skill lo necesita, ejecuta con un ejemplo razonable y acláralo en una línea al inicio.
5. Responde SIEMPRE en español, en Markdown limpio y directo. Nada de relleno.`

    const userMsg = input && String(input).trim()
      ? `Ejecuta la skill con este input:\n\n${String(input).trim()}`
      : 'Ejecuta la skill ahora.'

    const llmRes = await callLLM(session.user.id, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMsg },
    ], { model: 'gpt-4.1', temperature: 0.5, maxTokens: 3000 })

    const result = llmRes?.choices?.[0]?.message?.content || ''
    if (!result) throw new Error('El motor de ejecución no devolvió resultado')

    const duration = Date.now() - start

    // Track usage + execution log (best-effort, never block the response)
    try {
      await prisma.customSkill.update({
        where: { id: skill.id },
        data: { usageCount: { increment: 1 } },
      })
      await prisma.skillExecution.create({
        data: {
          userId: session.user.id,
          skillId: skill.id,
          method: 'execute',
          params: JSON.stringify({ input: input ? String(input).substring(0, 500) : null }),
          success: true,
          duration,
          resultSize: result.length,
          category: skill.category,
          trigger: 'manual',
        },
      })
    } catch (e) {
      console.error('[Skill Execute] tracking error:', e)
    }

    return NextResponse.json({ success: true, result, duration, engine: llmRes?.engine || 'octopus' })
  } catch (error) {
    console.error('[Skill Execute] error:', error)
    // Best-effort failure log
    try {
      const session = await getServerSession(authOptions)
      const body = await req.clone().json().catch(() => ({}))
      if (session?.user?.id && body?.skillId) {
        await prisma.skillExecution.create({
          data: {
            userId: session.user.id,
            skillId: String(body.skillId),
            method: 'execute',
            success: false,
            duration: Date.now() - start,
            error: error instanceof Error ? error.message : 'unknown',
            trigger: 'manual',
          },
        })
      }
    } catch { /* noop */ }
    return NextResponse.json({ error: 'Error ejecutando la skill. Intenta de nuevo.' }, { status: 500 })
  }
}
