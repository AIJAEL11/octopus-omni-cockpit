// ============================================
// OCTOPUS Nurture Templates — Reusable drip sequences
// ============================================

export interface NurtureStep {
  subject: string
  body: string
  delayHours: number       // hours after enrollment (from_enrollment mode)
  delayMode?: 'from_enrollment' | 'from_previous'
}

export interface NurtureTemplate {
  id: string
  name: string
  description: string
  source: string             // matching source for auto-enrollment
  tags: string[]             // matching tags for auto-enrollment
  steps: NurtureStep[]
}

// ============================================
// WILDVERSE BLOG — 3-email nurture sequence
// ============================================
export const WILDVERSE_NURTURE: NurtureTemplate = {
  id: 'wildverse-blog-nurture',
  name: 'Wildverse Blog — Welcome Nurture',
  description: 'Three-email drip sequence for leads captured from the Wildverse blog. Educates readers about hidden food ingredients and converts them to the Wildverse app.',
  source: 'wildverse-blog',
  tags: ['blog-lead', 'wildverse'],
  steps: [
    {
      subject: "You're eating more sugar than you think",
      body: `Hey {name},\n\nThanks for reading the Wildverse Blog — here's something most people don't realize:\n\nThe average packaged food contains 5+ hidden names for sugar. Dextrose, maltodextrin, rice syrup, fruit juice concentrate... they're all sugar in disguise.\n\nHere are 5 ingredients to watch out for:\n\n1. Maltodextrin — glycemic index higher than table sugar\n2. "Natural flavors" — often masks added sweeteners\n3. Fruit juice concentrate — sounds healthy, it's just sugar\n4. Rice syrup — processed the same as corn syrup\n5. Dextrose — literally glucose by another name\n\nWant to see what's really in your food?\n\n→ https://wildverse.io\n\nStay curious,\nThe Wildverse Team`,
      delayHours: 0,  // Immediate on enrollment
      delayMode: 'from_enrollment',
    },
    {
      subject: "Is your 'healthy' snack lying to you?",
      body: `Hey {name},\n\nWe did a deep dive on a popular protein bar that markets itself as "clean" and "wholesome."\n\nThe result? 12 hidden additives — including 3 types of sugar, an emulsifier linked to gut inflammation, and a coloring agent banned in several countries.\n\nThe label said "natural." The ingredients said otherwise.\n\nThis is why reading labels matters — but also why it's nearly impossible without help. There are over 6,000 food additives approved globally, and most of them hide behind technical names.\n\nWe built Wildverse to decode this for you. Just scan a product, and we'll tell you what's really inside.\n\n→ Scan your first product: https://wildverse.io\n\nKnowledge is your superpower,\nThe Wildverse Team`,
      delayHours: 24,  // 24h after enrollment
      delayMode: 'from_enrollment',
    },
    {
      subject: 'Time to see the truth.',
      body: `Hey {name},\n\nOver the last few days, you've learned that:\n\n• Sugar hides behind 50+ different names\n• "Healthy" snacks can contain 12+ hidden additives\n• Most labels are designed to confuse, not inform\n\nYou now know more than 90% of consumers about what's in their food.\n\nBut knowing isn't enough — the next step is having a tool that works for you every time you shop.\n\nThat's exactly why Wildverse exists. Scan any product. Get the truth. Make better choices for you and your family.\n\n→ Try Wildverse Free: https://wildverse.io\n\nYour health deserves transparency.\n\nThe Wildverse Team`,
      delayHours: 72,  // 72h after enrollment
      delayMode: 'from_enrollment',
    },
  ],
}

// ============================================
// Template Registry — add new templates here
// ============================================
export const NURTURE_TEMPLATES: NurtureTemplate[] = [
  WILDVERSE_NURTURE,
]

/**
 * Get a template by its ID.
 */
export function getNurtureTemplate(id: string): NurtureTemplate | undefined {
  return NURTURE_TEMPLATES.find(t => t.id === id)
}

/**
 * Build a Campaign.sequence JSON from a template.
 */
export function templateToSequence(template: NurtureTemplate): string {
  return JSON.stringify(template.steps)
}

/**
 * Build Campaign.targetCriteria JSON from a template.
 */
export function templateToCriteria(template: NurtureTemplate): string {
  return JSON.stringify({
    source: template.source,
    tags: template.tags,
  })
}
