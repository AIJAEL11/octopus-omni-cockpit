import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create test user with hashed password
  const hashedPassword = await bcrypt.hash('johndoe123', 12)

  await prisma.user.upsert({
    where: { email: 'john@doe.com' },
    update: {},
    create: {
      email: 'john@doe.com',
      name: 'John Doe',
      password: hashedPassword,
    },
  })

  // Ensure Rafael (Admin/CEO) account exists with proper settings
  const rafael = await prisma.user.upsert({
    where: { email: '1billontopview@gmail.com' },
    update: {
      tourCompleted: true,
      showWatermark: false,
      onboardedAt: new Date(),
    },
    create: {
      email: '1billontopview@gmail.com',
      name: 'Rafael Angel',
      password: await bcrypt.hash('octopus2024!', 12),
      tourCompleted: true,
      showWatermark: false,
      onboardedAt: new Date(),
    },
  })

  // Ensure Rafael has a default workspace
  const existingWs = await prisma.workspace.findFirst({ where: { userId: rafael.id } })
  if (!existingWs) {
    const ws = await prisma.workspace.create({
      data: {
        userId: rafael.id,
        name: 'Rafael Angel',
        slug: 'default',
        description: 'Workspace principal',
        isDefault: true,
        isActive: true,
      },
    })
    await prisma.user.update({
      where: { id: rafael.id },
      data: { activeWorkspaceId: ws.id },
    })
  }

  // Ensure Rafael has a Bridge API key
  const existingBridgeKey = await prisma.apiKey.findFirst({
    where: { userId: rafael.id, serviceType: 'hogar_bridge' },
  })
  if (!existingBridgeKey) {
    const token = `oct_bridge_${require('crypto').randomUUID().replace(/-/g, '').slice(0, 32)}`
    await prisma.apiKey.create({
      data: {
        userId: rafael.id,
        name: 'OCTOPUS Bridge',
        apiKey: token,
        serviceType: 'hogar_bridge',
      },
    })
  }

  // Ensure Rafael has onboarding data
  const existingOnboard = await prisma.onboardingData.findFirst({ where: { userId: rafael.id } })
  if (!existingOnboard) {
    await prisma.onboardingData.create({
      data: {
        userId: rafael.id,
        projectName: 'Wildverse LLC',
        projectType: 'saas',
        objective: 'Gestión empresarial con IA',
      },
    })
  }

  // Seed demo tasks for Rafael (only if none exist)
  const existingTasks = await prisma.taskItem.count({ where: { userId: rafael.id } })
  if (existingTasks === 0) {
    const now = new Date()
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1)
    const nextWeek = new Date(now); nextWeek.setDate(now.getDate() + 7)
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
    const in3Days = new Date(now); in3Days.setDate(now.getDate() + 3)

    await prisma.taskItem.createMany({
      data: [
        { userId: rafael.id, title: 'Revisar métricas de Growth Engine', description: 'Analizar el rendimiento de las campañas activas y optimizar CTAs', priority: 'high', status: 'in_progress', category: 'work', dueDate: tomorrow },
        { userId: rafael.id, title: 'Grabar video demo de Code Engine', description: 'Crear un walkthrough de 5 min mostrando templates full-stack', priority: 'urgent', status: 'pending', category: 'work', dueDate: yesterday },
        { userId: rafael.id, title: 'Configurar campaña de email marketing', description: 'Preparar secuencia de 5 emails para onboarding de nuevos usuarios', priority: 'high', status: 'pending', category: 'work', dueDate: in3Days },
        { userId: rafael.id, title: 'Actualizar landing page con testimonios', description: 'Agregar social proof de los primeros 100 usuarios beta', priority: 'medium', status: 'pending', category: 'work', dueDate: nextWeek },
        { userId: rafael.id, title: 'Ejercicio y meditación matutina', description: '30 min cardio + 15 min meditación guiada', priority: 'medium', status: 'completed', category: 'health', completedAt: now },
        { userId: rafael.id, title: 'Llamada con inversores potenciales', description: 'Presentar roadmap Q3 y métricas de tracción', priority: 'urgent', status: 'pending', category: 'finance', dueDate: tomorrow },
        { userId: rafael.id, title: 'Leer artículo sobre AI Agents 2026', description: 'Investigar tendencias en agentes autónomos para integrar en la plataforma', priority: 'low', status: 'pending', category: 'learning', dueDate: nextWeek },
        { userId: rafael.id, title: 'Revisar pull requests del equipo', description: 'Code review de las últimas features subidas esta semana', priority: 'medium', status: 'in_progress', category: 'work', dueDate: now },
      ],
    })
    console.log('  → 8 demo tasks created for Rafael')
  }

  console.log('Database seeded successfully!')
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })