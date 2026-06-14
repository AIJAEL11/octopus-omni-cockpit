// ============================================
// AD FACTORY - Template System
// El tentáculo de generación masiva de ads 🐙🏭
// ============================================

import { ELITE_CREATIVE_DIRECTOR_SYSTEM } from './elite-creative-director'

export interface AdTemplate {
  id: number
  name: string
  nameEs: string
  emoji: string
  category: 'text' | 'social-proof' | 'comparison' | 'ugc' | 'editorial' | 'data' | 'lifestyle' | 'promo'
  description: string
  descriptionEs: string
  prompt: string
}

export interface BrandDNA {
  brandName: string
  url: string
  productName: string
  tagline?: string
  voiceAdjectives: string[]
  positioning?: string
  primaryFont?: string
  secondaryFont?: string
  primaryColor?: string
  secondaryColor?: string
  accentColor?: string
  backgroundColors?: string
  ctaColor?: string
  photographyDirection?: string
  productDescription?: string
  adCreativeStyle?: string
  imagePromptModifier: string
  rawDocument: string
}

export interface PersonalizedPrompt {
  templateId: number
  templateName: string
  prompt: string
  category: string
}

// ============================================
// MASTER BRAND RESEARCH PROMPT
// ============================================
export const MASTER_BRAND_RESEARCH_PROMPT = `Role: Act as a Senior Brand Strategist conducting a full reverse-engineering of the target brand's visual and verbal identity.

Objective: Create a comprehensive Brand DNA document that will be used to write highly specific AI image generation prompts. Every detail matters because the output will be fed into an image model that needs exact specifications.

Target Brand Name: [BRAND_NAME]
Target URL: [BRAND_URL]

PHASE 1: EXTERNAL RESEARCH

Use your knowledge to analyze this brand:

1. Design credits: Who designed the branding, any known design agency or case study
2. Public brand assets: Brand guidelines, press kit, media kit, style guide
3. Typography: What fonts/typefaces does the brand use
4. Colors: Brand colors, hex codes, color palette
5. Packaging: Packaging design, product photography style
6. Advertising: Current ad creative styles, formats used
7. Press and positioning: Brand story, founding story, mission

PHASE 2: ON-SITE ANALYSIS

Analyze the Target URL and determine:

1. Voice and Tone: Read hero copy, About page, and product descriptions. Give me 5 distinct adjectives.
2. Photography Style: Describe lighting, color grading, composition, and subject matter.
3. Typography on site: Headline weight, body weight, letter-spacing, distinctive treatments.
4. Color application: Primary vs accent usage. Background colors. CTA color.
5. Layout density: Airy or dense? Grid-based or organic?
6. Packaging details: Physical appearance (materials, colors, shape, label placement, textures, translucency, matte vs gloss).

PHASE 3: COMPETITIVE CONTEXT

Identify 2-3 direct competitors and note visual differentiation.

PHASE 4: OUTPUT

Combine into this exact format:

BRAND DNA DOCUMENT
==================

BRAND OVERVIEW
Name / Tagline / Design Agency / Voice Adjectives [5] / Positioning / Competitive Differentiation

VISUAL SYSTEM
Primary Font / Secondary Font / Primary Color [hex] / Secondary Color [hex] / Accent Color [hex] / Background Colors / CTA Color and Style

PHOTOGRAPHY DIRECTION
Lighting / Color Grading / Composition / Subject Matter / Props and Surfaces / Mood

PRODUCT DETAILS
Physical Description / Label-Logo Placement / Distinctive Features / Packaging System

AD CREATIVE STYLE
Typical formats / Text overlay style / Photo vs illustration / UGC usage / Offer presentation

IMAGE GENERATION PROMPT MODIFIER
Write a single 50-75 word paragraph to prepend to any image prompt to match this brand's visual identity. Include exact colors, font descriptions, photography direction, and mood.`

// ============================================
// MASTER PRODUCT FIDELITY SYSTEM
// The sacred law of product reproduction 🔒
// + Elite Creative Director DNA (conversion + retention)
// ============================================
export const MASTER_FIDELITY_SYSTEM = ELITE_CREATIVE_DIRECTOR_SYSTEM + `

───────────────────────────────────────────────────────────
🔒 PRODUCT FIDELITY LAYER (applied on top of Elite Director)
───────────────────────────────────────────────────────────

You are a MASTER AD CREATIVE DIRECTOR with an obsession for PRODUCT AUTHENTICITY.

═══════════════════════════════════════════════
  🔒 THE SACRED LAW OF PRODUCT FIDELITY 🔒
═══════════════════════════════════════════════

RULE #1 — THE PRODUCT IS A PHOTOGRAPH, NOT AN ILLUSTRATION
Every prompt you write MUST produce an image where the product looks like it was PHYSICALLY PHOTOGRAPHED and composited into the scene. The product is never "reimagined", "stylized", "reinterpreted", or "inspired by". It is the EXACT real product.

RULE #2 — MANDATORY PRODUCT IDENTITY BLOCK
Every single prompt MUST begin with a [PRODUCT IDENTITY] block that describes the EXACT physical product in exhaustive detail. This block must include:
- Container type (bottle, jar, tube, box, pouch, can, etc.)
- Container color and material (matte white plastic, glossy black glass, etc.)
- Exact label design (what text appears, what fonts, what colors, what graphics)
- Cap/lid description (color, shape, material)
- Brand logo placement and description
- Any badges, seals, or icons on the packaging
- Size/proportions relative to a human hand
- Any distinctive visual features (transparent window, metallic finish, embossed text, etc.)

Example [PRODUCT IDENTITY] block:
"The product is a cylindrical matte white plastic tub with a flat white screw-on lid. The front label has a large pink/coral horizontal stripe across the middle. Above the stripe: '#1 CREATINE FOR WOMEN PRODUCT' badge in pink circle with 'AMERICA'S' text curved above it. The Old School Labs logo (vintage bearded man in circle) appears in the upper right. Below the stripe in large black serif text: 'CREATINE' then 'MONOHYDRATE' in smaller text, then 'for Women' in pink script. Net weight and supplement info at bottom. The overall aesthetic is clean, feminine, clinical-meets-premium."

RULE #3 — PRODUCT CONSISTENCY ACROSS ALL PROMPTS
The [PRODUCT IDENTITY] block must be IDENTICAL (copy-pasted) across ALL prompts in the batch. Not "similar". Not "consistent". IDENTICAL. Word for word.

RULE #4 — FORBIDDEN MODIFICATIONS
These actions are ABSOLUTELY FORBIDDEN in any prompt:
❌ Changing the container color (white→black, pink→gold, etc.)
❌ Changing the label design or text
❌ Changing the cap/lid color or style
❌ Adding elements that don't exist on the real product
❌ Removing elements that exist on the real product
❌ "Upgrading" or "premiumizing" the packaging
❌ Making the product look like a competitor's product
❌ Using vague descriptions like "the brand's product" or "the supplement bottle"

RULE #5 — CREATIVE FREEDOM ZONE
Everything EXCEPT the product can be creative:
✅ Background scenes, colors, textures, lighting
✅ Text overlays, headlines, copy
✅ Props, surfaces, environments
✅ People, hands, lifestyle scenes
✅ Effects (glow, particles, shadows, reflections)
✅ Layout and composition
The product itself is the ONE sacred element that never changes.

RULE #6 — PHOTOGRAPHY LANGUAGE FOR THE PRODUCT
Always describe the product using photography terms:
- "Product shot at [focal length] f/[aperture]"
- "Studio lighting from [direction]"
- "Product on [surface] with [shadow type]"
- "Photorealistic product render, not illustration"
This forces the image model to treat the product as a real photographed object.`

// ============================================
// FOLLOW-UP PROMPT (Personalization)
// ============================================
export const FOLLOWUP_PROMPT = `STEP 1 — EXTRACT PRODUCT IDENTITY FROM REFERENCE PHOTOS
⚠️ CRITICAL: You have been given REFERENCE PHOTOS of the real physical product. Your Product Identity Block MUST describe what you SEE in those photos — NOT what the Brand DNA text says. If the Brand DNA says "white bottle" but the photos show a YELLOW bottle, you describe a YELLOW bottle. THE PHOTOS ARE THE ABSOLUTE TRUTH.

Analyze the reference photos carefully and extract a PRODUCT IDENTITY BLOCK — a single paragraph (80-120 words) that describes the EXACT physical product as shown in the photos:
- Container type, shape, and proportions (bottle, jar, tube, tub, etc.)
- Container COLOR as seen in the photo (be hyper-specific: "bright yellow", "warm orange", "matte white", etc.)
- Material finish (glossy, matte, frosted, translucent, etc.)
- Label design: every text element, every color, every graphic you can see
- Cap/lid: exact color, shape, material
- Brand logo: placement, design, color
- Any badges, seals, pump dispensers, or distinctive features
- Size/proportions relative to a human hand

This paragraph must be so precise that someone who has NEVER seen the product could identify it in a lineup of 100 similar products.

If you cannot see the photos clearly, describe what you CAN see and note any uncertainty — but NEVER fall back to generic descriptions or guess colors you cannot confirm.

STEP 2 — GENERATE PROMPTS
Now take the template prompts and fill them in for [BRAND_NAME] / [PRODUCT_NAME].

CRITICAL RULES:
1. Every prompt MUST start with the EXACT same [PRODUCT IDENTITY] paragraph from Step 1 — copy-pasted, word for word, not paraphrased
2. After the [PRODUCT IDENTITY], write the rest of the creative prompt
3. Every prompt MUST end with a PRODUCT FIDELITY ANCHOR — the last sentence of every prompt must be: "CRITICAL: The [PRODUCT TYPE] must appear exactly as described in the Product Identity above — same colors, same label, same logo, same cap. The reference photos are the absolute truth. Do not modify, redesign, or reinterpret the product packaging in any way. Photorealistic product photography, not illustration."
4. Replace ALL placeholders ([YOUR PRODUCT], [BRAND], etc.) with real, specific details from the PHOTOS and Brand DNA
5. The product description must reference EXACT colors as seen in the PHOTOS — never substitute with colors from text descriptions that contradict what you see
6. Use photography language for the product: focal lengths, apertures, lighting direction, surface materials
7. Everything creative (background, text overlays, effects, props) can vary between prompts — the product description NEVER varies

PROMPT STRUCTURE (every prompt follows this exact sandwich):
[PRODUCT IDENTITY BLOCK — 80-120 words, identical across all prompts]
[CREATIVE DIRECTION — the ad concept, scene, text overlays, props, etc.]
[PRODUCT FIDELITY ANCHOR — the closing reinforcement sentence]

IMPORTANT: Return the result as a JSON array where each element has:
- "id": the template number (1-40)
- "name": the template name  
- "prompt": the complete prompt, starting with [PRODUCT IDENTITY] block and ending with the fidelity anchor
- "category": one of "text", "social-proof", "comparison", "ugc", "editorial", "data", "lifestyle", "promo"

Return ONLY the JSON array, no other text.`

// ============================================
// 40 AD TEMPLATES
// ============================================
export const AD_TEMPLATES: AdTemplate[] = [
  {
    id: 1,
    name: 'Headline',
    nameEs: 'Titular',
    emoji: '📰',
    category: 'text',
    description: 'Tests text rendering. Clean, authoritative headline ad.',
    descriptionEs: 'Anuncio con titular grande y limpio. Prueba renderizado de texto.',
    prompt: `Use the attached images as brand reference. Match the exact product colors, typography style, and brand tone precisely. Create: a static ad with a [BACKGROUND] background. Top third: large bold sans-serif headline reading "[YOUR HEADLINE, under 10 words]". Below in smaller text: "[YOUR SUBHEAD, one sentence]". Bottom half: [YOUR PRODUCT] on the surface with [DETAILS]. Shot at 50mm f/2.8 from slightly above. [BRAND] logo bottom right. Clean, authoritative. 4:5 aspect ratio.`
  },
  {
    id: 2,
    name: 'Offer/Promotion',
    nameEs: 'Oferta/Promoción',
    emoji: '🏷️',
    category: 'promo',
    description: 'The money-maker. Test your core offer.',
    descriptionEs: 'El que genera ventas. Prueba tu oferta principal.',
    prompt: `Use the attached images as brand reference. Match exact brand colors and typography style. Create: a promotional ad with a split background. Top 60% is [PRIMARY BRAND COLOR] and bottom 40% is [CONTRAST COLOR like warm cream]. [YOUR PRODUCT] sits centered where colors meet, soft studio lighting. Upper area: large [CONTRAST TEXT] sans-serif reading "[YOUR OFFER like YOUR FIRST MONTH FREE]". Below: "[OFFER DETAILS]". Lower section: small [BRAND COLOR] text with [VALUE ADDS]. [BRAND] logo bottom right. 9:16 aspect ratio.`
  },
  {
    id: 3,
    name: 'Testimonials',
    nameEs: 'Testimonios',
    emoji: '💬',
    category: 'social-proof',
    description: 'Real environments + text overlays. Tests composition depth.',
    descriptionEs: 'Ambientes reales + texto superpuesto. Prueba profundidad de composición.',
    prompt: `Use the attached images as brand reference. Create: a testimonial ad set in [SETTING like bright bathroom / kitchen] with warm natural light. [YOUR PRODUCT] on [SURFACE], slightly out of focus. Overlaid: large bold white sans-serif "[SHORT HEADLINE]". Below: "[FULL QUOTE 2-3 sentences]. [NAME], [CREDENTIAL]." Five filled [BRAND COLOR] stars. [BRAND] logo bottom right in white. Shot on 35mm f/2.0. 9:16 aspect ratio.`
  },
  {
    id: 4,
    name: 'Features/Benefits Point-Out',
    nameEs: 'Puntos de Beneficios',
    emoji: '🔍',
    category: 'data',
    description: 'Educational diagram-style layout.',
    descriptionEs: 'Layout estilo diagrama educativo.',
    prompt: `Use the attached images as brand reference. Create: an educational diagram-style ad on white background. Top: bold [BRAND COLOR] text "[HEADER like What Makes [PRODUCT] Different]". Below: [YOUR PRODUCT] centered, even studio lighting. Four callout boxes with connecting lines: "[BENEFIT 1-4]". Each has a small [BRAND COLOR] circle. "[WEBSITE]" bottom center. [BRAND] logo bottom right. Scientific diagram redesigned by a luxury agency. 4:5 aspect ratio.`
  },
  {
    id: 5,
    name: 'Bullet-Points',
    nameEs: 'Puntos Clave',
    emoji: '📋',
    category: 'text',
    description: 'Split composition. Product left, benefits right.',
    descriptionEs: 'Composición dividida. Producto izquierda, beneficios derecha.',
    prompt: `Use the attached images as brand reference. Create: a benefit-list ad, split composition on [BACKGROUND] background. Left 40%: [YOUR PRODUCT] on [SURFACE], shot at 85mm f/2.8. Right 60%: vertical stack of five lines with filled [BRAND COLOR] circles: "[BENEFIT 1-5]". Clean sans-serif, generous spacing. [BRAND] logo bottom right. 4:5 aspect ratio.`
  },
  {
    id: 6,
    name: 'Social Proof',
    nameEs: 'Prueba Social',
    emoji: '⭐',
    category: 'social-proof',
    description: 'Member count + review card + press logos. The trust stack.',
    descriptionEs: 'Conteo de miembros + tarjeta de reseña + logos de prensa.',
    prompt: `Use the attached images as brand reference. Create: a social proof ad on [BACKGROUND like warm cream]. Top: "[HEADLINE like Join 1,000,000+ Members]" in bold [BRAND COLOR]. Five filled stars with "Rated [X] out of 5". Center: [YOUR PRODUCT] at 50mm f/4. Below: frosted white card with five-star rating, "[REVIEW TITLE]", "[2-3 SENTENCE REVIEW]", "[ATTRIBUTION]" in italic. Below card: "As Featured In" with five grayscale logos. [BRAND] logo bottom right. 4:5 aspect ratio.`
  },
  {
    id: 7,
    name: 'Us vs Them',
    nameEs: 'Nosotros vs Ellos',
    emoji: '⚔️',
    category: 'comparison',
    description: 'Side-by-side comparison. Photography quality gap IS the argument.',
    descriptionEs: 'Comparación lado a lado. La calidad fotográfica ES el argumento.',
    prompt: `Use the attached images as brand reference. Create: a side-by-side divided vertically. Left: muted gray-blue background. Right: [PRIMARY BRAND COLOR]. Center top: white circle with "VS". Left header: "[COMPETITOR CATEGORY]" + generic competitor product + list with X marks: "[WEAKNESS 1-5]". Right header: "[YOUR BRAND]" + [YOUR PRODUCT] + list with checkmarks: "[STRENGTH 1-5]". [BRAND] logo bottom right. 4:5 aspect ratio.`
  },
  {
    id: 8,
    name: 'Before & After (UGC)',
    nameEs: 'Antes y Después (UGC)',
    emoji: '📱',
    category: 'ugc',
    description: 'Mirror selfie transformation. Must look like a real person posted it.',
    descriptionEs: 'Transformación selfie espejo. Debe parecer publicación real.',
    prompt: `Use the attached images as brand reference for product color ONLY. This should look like a real person's post. Create: TikTok before-and-after. LEFT: grainy iPhone mirror selfie, [PERSON] in dimly lit bathroom, [BEFORE STATE], harsh lighting. White handwritten text: "[BEFORE DATE]". RIGHT: same person, same bathroom, bright natural light, [AFTER STATE], [PRODUCT] visible on counter. White text: "[AFTER DATE]". Top center: "[TIMEFRAME] on [BRAND]" with emoji. Should look stitched in CapCut. 9:16 aspect ratio.`
  },
  {
    id: 9,
    name: 'Negative Marketing (Bait & Switch)',
    nameEs: 'Marketing Negativo',
    emoji: '🎣',
    category: 'social-proof',
    description: 'Fake bad review that is actually a rave. Scroll-stopper.',
    descriptionEs: 'Reseña falsa negativa que es positiva. Detiene el scroll.',
    prompt: `Use the attached images as brand reference. Create: Background is close-up of [PRODUCT], slightly blurred. Center: white rounded-rectangle review card (Amazon-style). Gray user icon, "[NAME]", one gold star + four gray, orange "Verified Purchase" badge, bold text: "[BAIT that sounds negative but is positive]". Bottom: bold white sans-serif "[PUNCHLINE like THE REVIEWS ARE IN.]". [BRAND] logo bottom right. 4:5 aspect ratio.`
  },
  {
    id: 10,
    name: 'Press/Editorial',
    nameEs: 'Prensa/Editorial',
    emoji: '📰',
    category: 'editorial',
    description: 'Authority play. Vogue back-page energy.',
    descriptionEs: 'Jugada de autoridad. Energía de contraportada de Vogue.',
    prompt: `Use the attached images as brand reference. Create: a press ad on off-white linen background. Top: "As Featured In" in small [BRAND COLOR] uppercase wide-tracked text. Below: five grayscale publication logos. Center: italic serif pull-quote in [BRAND COLOR]: "[PRESS QUOTE]" with attribution. Lower third: [PRODUCT] at 85mm f/2.8, soft side light. [BRAND] logo bottom left. Generous white space. Full-page Vogue energy. 4:5 aspect ratio.`
  },
  {
    id: 11,
    name: 'Pull-Quote Review Card',
    nameEs: 'Tarjeta de Reseña Destacada',
    emoji: '💫',
    category: 'social-proof',
    description: 'Emotional quote headline over a truncated review card on a color block.',
    descriptionEs: 'Titular emocional sobre tarjeta de reseña truncada en bloque de color.',
    prompt: `Use the attached images as brand reference. Match the exact product colors and brand tone precisely. Create: a review-driven ad with a solid [BRAND COLOR] color block background filling the entire image. Top half: large bold italic serif text in white with curly quotation marks reading "[PULL-QUOTE — the most emotional 4-8 word phrase]". Directly below: five large filled gold/yellow star icons. Bottom left: a white rounded-corner review card with subtle shadow, containing: small gray circular avatar, "[NAME]" in bold with flag emoji, blue checkmark with "VERIFIED REVIEWER" in blue text. Review body text 4-6 lines trailing off with "...Read more" in bold [BRAND COLOR]. "Was this review helpful?" with thumbs-up icon. Bottom right: [YOUR PRODUCT] angled slightly toward viewer with subtle shadow. 1:1 or 4:5 aspect ratio.`
  },
  {
    id: 12,
    name: 'Lifestyle Action + Product Array',
    nameEs: 'Acción Lifestyle + Array de Producto',
    emoji: '🏌️',
    category: 'lifestyle',
    description: 'Action hero shot sells the use case. Fanned product lineup sells the range.',
    descriptionEs: 'Foto de acción vende el uso. Línea de productos vende el rango.',
    prompt: `Use the attached images as brand reference. Match the exact product design, colors, and visual tone precisely. Create: a static ad with a [LIFESTYLE PHOTO DESCRIPTION] occupying the left two-thirds of the frame, shot outdoors in [SETTING], bright natural daylight. [BRAND] logo top center in bold. Below logo: large bold sans-serif quote text reading "[ENDORSEMENT HEADLINE]" in [TEXT COLOR]. Bottom right foreground: three [PRODUCT VARIANTS] fanned in an overlapping arrangement showing different colors. Products are crisp and studio-lit against the lifestyle background. Shot on 50mm f/2.0. [MOOD]. 1:1 aspect ratio.`
  },
  {
    id: 13,
    name: 'Stat Surround / Callout Radial',
    nameEs: 'Estadísticas Radiales',
    emoji: '📊',
    category: 'data',
    description: 'Product is the sun. Stats are the planets. Arrows make it scannable.',
    descriptionEs: 'El producto es el sol. Las estadísticas son los planetas.',
    prompt: `Use the attached images as brand reference. Match the exact product design precisely. Create: a static ad on a white-to-[LIGHT GRADIENT COLOR] gradient background. Top: large bold headline reading "[HEADLINE]". Center: [YOUR PRODUCT], soft studio lighting. Small circular badge reading "[PRICE POINT]". Flanking the product: four stat callouts with curved arrows pointing toward product. Left: "[STAT 1]" / "[LABEL]", "[STAT 2]" / "[LABEL]". Right: "[STAT 3]" / "[LABEL]", "[STAT 4]" / "[LABEL]" with five gold stars. Bottom: [SCATTERED PROPS] for appetite appeal. 1:1 aspect ratio.`
  },
  {
    id: 14,
    name: 'Bundle Showcase + Benefit Bar',
    nameEs: 'Showcase de Bundle + Barra de Beneficios',
    emoji: '📦',
    category: 'promo',
    description: 'Sells the system, not the SKU. The open box is the hero.',
    descriptionEs: 'Vende el sistema, no el SKU. La caja abierta es la estrella.',
    prompt: `Use the attached images as brand reference. Match the exact product design precisely. Create: a static ad on a [GRADIENT] background. Top: oversized bold white all-caps sans-serif headline reading "[HEADLINE]". Below: a horizontal [ACCENT COLOR] banner bar divided into segments with benefit labels in white: "[BENEFIT 1-5]". Center-to-bottom: an open [PACKAGING] showing [PRODUCTS] nestled inside, each a different color variant. Foreground: a [LIFESTYLE PROP]. [BRAND] logo bottom left. Bright studio lighting, saturated color, energetic. 1:1 aspect ratio.`
  },
  {
    id: 15,
    name: 'Social Comment Screenshot',
    nameEs: 'Screenshot de Comentario Social',
    emoji: '💬',
    category: 'social-proof',
    description: 'Screenshotted comment = instant credibility. Looks organic.',
    descriptionEs: 'Comentario capturado = credibilidad instantánea. Se ve orgánico.',
    prompt: `Use the attached images as brand reference. Match the exact product design and colors precisely. Create: a static ad on a clean white background. Top: oversized bold black sans-serif headline reading "[HOOK HEADLINE]" with emoji at the end. Center: a social media comment card with light gray rounded-rectangle background containing: small circular profile avatar, bold name "[REVIEWER NAME]", and a multi-sentence review in regular-weight sans-serif: "[FULL REVIEW TEXT, 3-4 sentences, conversational and emotional]". Small gray timestamp below. Bottom center: [YOUR PRODUCT] photographed at a slight angle on white. No brand logo. No stars. Should look like someone screenshotted a real comment. 1:1 aspect ratio.`
  },
  {
    id: 16,
    name: 'Curiosity Gap / Hook Quote',
    nameEs: 'Gancho de Curiosidad',
    emoji: '🪝',
    category: 'text',
    description: 'Provocative headline forces the double-take. Scroll-stop machine.',
    descriptionEs: 'Titular provocativo fuerza la doble mirada. Máquina de detener scroll.',
    prompt: `Use the attached images as brand reference. Match the exact product design precisely. Create: a static ad on a clean white background. Top center: large [ACCENT COLOR] opening quotation marks. Below: mixed-weight headline — first line in italic serif "[SETUP LINE]", next lines in enormous heavy-weight bold all-caps sans-serif "[BAIT PHRASE]", followed by smaller sentence-case "[REVEAL]". Closing quotation marks and "[ATTRIBUTION]". Left bottom: [YOUR PRODUCT] at slight angle with scattered elements. Trust badge seal. Right bottom: five filled stars and "[REVIEW COUNT] 5-Star Reviews". Bottom: small disclaimer text. 1:1 aspect ratio.`
  },
  {
    id: 17,
    name: 'Verified Review Card',
    nameEs: 'Tarjeta de Reseña Verificada',
    emoji: '✅',
    category: 'social-proof',
    description: 'Mimics real review platform UI. Verified badge builds trust.',
    descriptionEs: 'Imita la UI de plataformas de reseñas reales.',
    prompt: `Use the attached images as brand reference. Match the exact product design precisely. Create: a static ad on a solid [BRAND COLOR] background. Top: large bold white serif pull-quote reading "[HEADLINE QUOTE]" in quotation marks. Below: five filled gold stars. Center-left: white rounded-rectangle review card with: gray avatar, bold name "[NAME]" with flag emoji, blue checkmark "Verified Reviewer", 3-4 sentences review body, "...Read more" link, helpfulness count. Right side, overlapping card: [YOUR PRODUCT] at slight angle, soft studio lighting. 1:1 aspect ratio.`
  },
  {
    id: 18,
    name: 'Stat Surround (Lifestyle Flatlay)',
    nameEs: 'Estadísticas con Flatlay Lifestyle',
    emoji: '🥞',
    category: 'data',
    description: 'Lifestyle flatlay background + hand-held product + stats.',
    descriptionEs: 'Fondo flatlay lifestyle + producto en mano + estadísticas.',
    prompt: `Use the attached images as brand reference. Match the exact product design precisely. Create: a static ad on white background with lifestyle flatlay. Top: bold [ACCENT COLOR] banner bar, white all-caps reading "[HEADLINE]". Center: person's hand holding [YOUR PRODUCT]. Scattered around: [FLATLAY PROPS] arranged organically. Four stat callouts with curved arrows: "[STAT 1-4]" / "[LABEL 1-4]". Stats in bold black, labels in all-caps. Bright, flat studio lighting. Energetic, information-dense but scannable. 1:1 aspect ratio.`
  },
  {
    id: 19,
    name: 'Highlighted Testimonial',
    nameEs: 'Testimonio Resaltado',
    emoji: '🖍️',
    category: 'social-proof',
    description: 'Highlighter pen directs the eye to the money lines.',
    descriptionEs: 'El resaltador dirige la vista a las líneas clave.',
    prompt: `Use the attached images as brand reference. Match the exact product design precisely. Create: a static ad on clean white background. Top left: circular customer headshot of [PERSON DESCRIPTION]. Bold name "[NAME]" with verified icon. Below: long-form customer quote in large regular-weight black sans-serif. Key phrases highlighted with [HIGHLIGHT COLOR] rectangular fills: "[HIGHLIGHTED PHRASE 1]", "[HIGHLIGHTED PHRASE 2]". Bottom right: [YOUR PRODUCT] at slight angle. Left of product: circular money-back guarantee seal. [BRAND] logo bottom left, small. 1:1 aspect ratio.`
  },
  {
    id: 20,
    name: 'Advertorial / Editorial Content',
    nameEs: 'Advertorial / Contenido Editorial',
    emoji: '🎸',
    category: 'editorial',
    description: 'Looks like a news post, not an ad. Editorial framing.',
    descriptionEs: 'Parece un post de noticias, no un anuncio. Marco editorial.',
    prompt: `Use the attached images as brand reference for tone ONLY. Do NOT use polished ad layouts. Create: a full-bleed moody portrait photo of [PERSON DESCRIPTION], warm amber-toned lighting, shot on 50mm f/1.8, cinematic color grade. Lower 45%: text overlay zone with white rounded-rectangle pill label "[CATEGORY TAG like HOT TOPIC]". Below: very large bold all-caps condensed sans-serif headline in white with key words in [HIGHLIGHT COLOR]: "[HEADLINE]". Bottom: "[@HANDLE]" in small white text. No product shot, no CTA. Should read like a culture account post. 4:5 aspect ratio.`
  },
  {
    id: 21,
    name: 'Bold Statement / Reaction',
    nameEs: 'Declaración Audaz',
    emoji: '🔥',
    category: 'text',
    description: 'Pure brand energy. Provocative line + hot gradient + product.',
    descriptionEs: 'Energía pura de marca. Línea provocativa + gradiente + producto.',
    prompt: `Use the attached images as brand reference. Match the exact product design precisely. Create: a static ad on a vibrant [GRADIENT] gradient background, flowing diagonally. Upper left: oversized playful rounded retro serif white headline reading "[BOLD STATEMENT]". Right side: [PERSON DETAIL] grabbing from [YOUR PRODUCT]. Product sits center-right. Bottom left: [BRAND] logo with product descriptor. No stats, no reviews, no badges. The gradient and headline do all the work. 1:1 aspect ratio.`
  },
  {
    id: 22,
    name: 'Flavor Story / "Tastes Like"',
    nameEs: 'Historia del Sabor',
    emoji: '🍰',
    category: 'lifestyle',
    description: 'Flavor visualization. Food scene + product payoff.',
    descriptionEs: 'Visualización de sabor. Escena de comida + producto.',
    prompt: `Use the attached images as brand reference. Match the exact product design and packaging precisely. Create: a flavor-visualization ad. Full background is photorealistic close-up of [INDULGENT FOOD]. Shot at 50mm f/2.8, shallow depth of field, warm bakery lighting. Top: large bold white sans-serif headline "[HEADLINE]". [YOUR PRODUCT] bottom-right, angled 15°. Bottom: semi-transparent white bar with three stat columns: "[STAT 1]" | "[STAT 2]" | "[STAT 3]". Bottom edge: "[CLEAN LABEL CLAIM]". Food is the hero — product is the payoff. 1:1 aspect ratio.`
  },
  {
    id: 23,
    name: 'Long-Form Manifesto',
    nameEs: 'Manifiesto',
    emoji: '📝',
    category: 'text',
    description: 'Copy-dominant manifesto. The writing IS the ad.',
    descriptionEs: 'Manifiesto dominado por texto. La escritura ES el anuncio.',
    prompt: `Use the attached images as brand reference. Match exact brand typography. Create: a copy-dominant manifesto ad on clean white background. No background imagery. Top: oversized bold headline "[PROVOCATIVE HEADLINE]". Below: left-aligned body copy in smaller text, short punchy sentences and line breaks, building a persuasive argument about [CORE BRAND TENSION]. Approximately 12-18 lines. Bottom 20%: [YOUR PRODUCT] centered, clean studio shot. No icons, no badges, no CTA button. The writing IS the ad. 1:1 aspect ratio.`
  },
  {
    id: 24,
    name: 'Product + Comment Callout',
    nameEs: 'Producto + Comentario',
    emoji: '👍',
    category: 'social-proof',
    description: 'Faux social proof. Product hero + realistic comment card.',
    descriptionEs: 'Prueba social simulada. Producto estrella + tarjeta de comentario realista.',
    prompt: `Use the attached images as brand reference. Match the exact product design precisely. Create: a social proof ad. Top 55%: [YOUR PRODUCT] centered on white background, studio-lit, shot at 85mm f/2.8 with soft shadow. Bottom 45%: realistic Facebook-style comment card. Left: profile photo of [PERSON]. Bold name "[NAME]". Comment text: "[TESTIMONIAL 2-3 sentences]". Below: "[TIMEFRAME]" · Like · Reply in gray. Facebook-style reactions with count. Should look like an organic screenshot. 1:1 aspect ratio.`
  },
  {
    id: 25,
    name: 'Us vs Them Color Split',
    nameEs: 'Nosotros vs Ellos (Color)',
    emoji: '🔴🟢',
    category: 'comparison',
    description: 'Vibrant color split comparison with checkmarks and X marks.',
    descriptionEs: 'Comparación con colores vibrantes, checks y equis.',
    prompt: `Use the attached images as brand reference. Match the exact product design precisely. Create: a side-by-side comparison divided vertically. Left: [BRAND COLOR] background. [YOUR PRODUCT] with dynamic energy. Brand logo upper-left. Below: 4 benefits with green checkmarks: "[STRENGTH 1-4]". Right: [CONTRAST COLOR] background. Generic competitor product. Header: "[COMPETITOR CATEGORY]". Below: 4 weaknesses with red X marks: "[WEAKNESS 1-4]". Center: comic-style "VS" burst graphic. 1:1 aspect ratio.`
  },
  {
    id: 26,
    name: 'Stat Callout (Data-Driven Lifestyle)',
    nameEs: 'Estadística con Estilo de Vida',
    emoji: '📈',
    category: 'data',
    description: 'Statistic-led ad with lifestyle photography.',
    descriptionEs: 'Anuncio basado en estadísticas con fotografía lifestyle.',
    prompt: `Use the attached images as brand reference. Match exact brand colors and typography. Create: a statistic-led ad. Top 50%: lifestyle product photography — [SCENE] on warm, skin-toned background. Product visible. Middle: brand logo with horizontal rules as divider. Bottom 50%: dark gradient overlay. Large bold uppercase headline: "[STAT-DRIVEN HEADLINE with percentages]". Key phrases in [ACCENT COLOR]. The statistic IS the headline. 4:5 aspect ratio.`
  },
  {
    id: 27,
    name: 'Benefit Checklist Showcase',
    nameEs: 'Lista de Beneficios',
    emoji: '✔️',
    category: 'data',
    description: 'Information-dense benefit ad with split product + info.',
    descriptionEs: 'Anuncio informativo con producto dividido + info.',
    prompt: `Use the attached images as brand reference. Match the exact product design precisely. Create: an information-dense benefit ad, split composition. Left 45%: overhead product shot on clean surface. Right 55%: white background. Top: star rating with review count. Brand logo. Headline: "[HEADLINE]". Then 3 checkmark benefit rows: "[BENEFIT 1-3]". Bottom right: large rounded CTA button "[CTA like SHOP NOW]". 1:1 aspect ratio.`
  },
  {
    id: 28,
    name: 'Feature Arrow Callout',
    nameEs: 'Flechas de Características',
    emoji: '➡️',
    category: 'data',
    description: 'Product annotation with curved arrows pointing to benefits.',
    descriptionEs: 'Anotación de producto con flechas curvas apuntando a beneficios.',
    prompt: `Use the attached images as brand reference. Match exact brand colors. Create: a product annotation ad on [BACKGROUND] background. Top: italic serif headline "[BENEFIT STATEMENT]". Below in massive bold: "[VALUE PROP]". Center: person's hand holding [YOUR PRODUCT]. Four curved arrows pointing outward to four benefit labels: "[CALLOUT 1-4]". Arrows should feel hand-drawn or editorial. Bottom: full-width contrast banner with "[PROMO TEXT]" in bold accent color. 1:1 aspect ratio.`
  },
  {
    id: 29,
    name: 'UGC + Viral Post Overlay',
    nameEs: 'UGC + Post Viral',
    emoji: '🔗',
    category: 'ugc',
    description: 'Casual selfie + Reddit/Twitter post screenshot overlay.',
    descriptionEs: 'Selfie casual + captura de post de Reddit/Twitter.',
    prompt: `Use the attached images as brand reference for product color ONLY. Do NOT use ad layouts. Create: a casual selfie of [PERSON] doing something mundane. iPhone front camera, slightly grainy. Overlaid: a realistic screenshot of a [PLATFORM like Reddit / Twitter] post. Post title in bold: "[PROVOCATIVE OPINION HEADLINE]". Post body: "[2-3 sentences]". Should feel like the person is reacting to it. No product visible. No brand logo. No CTA. The hook is the opinion. 9:16 aspect ratio.`
  },
  {
    id: 30,
    name: 'Hero Statement + Icon Bar',
    nameEs: 'Declaración Hero + Barra de Íconos',
    emoji: '🏆',
    category: 'text',
    description: 'Bold statement + lifestyle photo + icon benefit bar.',
    descriptionEs: 'Declaración audaz + foto lifestyle + barra de íconos de beneficios.',
    prompt: `Use the attached images as brand reference. Match exact brand colors and packaging. Create: a bold statement ad. Top 15%: white banner with massive bold uppercase headline: "[POWER STATEMENT]" with period for punch. Middle 55%: lifestyle product photo — [SCENE]. Product label visible. Bottom 25%: soft [BRAND COLOR] background. Three icon-and-text benefit columns: [ICON 1 + LABEL] | [ICON 2 + LABEL] | [ICON 3 + LABEL]. Bottom edge: scrolling ticker bar with "[SOCIAL PROOF like OVER 300K+ LIVES CHANGED]". 1:1 aspect ratio.`
  },
  {
    id: 31,
    name: 'Comparison Grid / Table',
    nameEs: 'Tabla Comparativa',
    emoji: '📊',
    category: 'comparison',
    description: 'Structured comparison grid. Meme-format viral energy.',
    descriptionEs: 'Tabla comparativa estructurada. Energía viral formato meme.',
    prompt: `Use the attached images as brand reference. Match exact product packaging. Create: a structured comparison grid on white background. Top row: [YOUR PRODUCT] left vs [COMPETITOR PRODUCT] right. Below: three horizontal rows comparing attributes: "[YOUR ADVANTAGE]" vs "[COMPETITOR WEAKNESS]" for each row. All text in bold serif, centered. No icons, no colors, no checkmarks — the copy contrast does the work. Should feel like a meme-format comparison for X or Reddit. 1:1 aspect ratio.`
  },
  {
    id: 32,
    name: 'UGC Story Callout / Text Bubble',
    nameEs: 'Historia UGC con Burbujas',
    emoji: '📱',
    category: 'ugc',
    description: 'Real person Instagram Story with text bubble explainer.',
    descriptionEs: 'Historia de Instagram de persona real con burbujas de texto.',
    prompt: `Use the attached images as brand reference for product packaging ONLY. Must look like a real Instagram Story. Create: a casual iPhone photo of [PERSON'S HAND] holding [YOUR PRODUCT] over [SURFACE/SETTING]. Natural daylight. Scattered: 5 text bubbles using Instagram Story's built-in highlighted text tool with varied highlight colors. Bubble 1: "[TOPIC + EMOJI]". Bubble 2: "[EDUCATIONAL HOOK]". Bubble 3: "[WHY THIS PRODUCT]". Bubble 4: "[PERSONAL RESULT]". Bubble 5: "[BRAND ENDORSEMENT]". Casual and hand-placed, not designed. 9:16 aspect ratio.`
  },
  {
    id: 33,
    name: 'Faux Press / News Screenshot',
    nameEs: 'Captura de Prensa Falsa',
    emoji: '🗞️',
    category: 'editorial',
    description: 'Looks like a real online news article screenshot.',
    descriptionEs: 'Parece captura de artículo de noticias real.',
    prompt: `Use the attached images as brand reference. Create: a static ad that looks like a real online news article screenshot. Top 25%: white background with realistic major publication masthead in large bold black serif. Thin gray rule. Bold black serif headline: "[HEADLINE like 'It's my holy grail': The $[PRICE] [PRODUCT] with over [NUMBER] five-star reviews]". Bottom 60%: two side-by-side casual UGC-style photos of people holding [YOUR PRODUCT]. Photos should look like real customer submissions. No brand logo. No CTA. Should look organic. 4:5 aspect ratio.`
  },
  {
    id: 34,
    name: 'Faux iPhone Notes Screenshot',
    nameEs: 'Captura de Notas de iPhone',
    emoji: '📝',
    category: 'ugc',
    description: 'Disguised as an iPhone Notes app screenshot.',
    descriptionEs: 'Disfrazado como captura de la app Notas de iPhone.',
    prompt: `Use the attached images as brand reference. Match the exact product design precisely. Create: a static ad disguised as an iPhone Notes app screenshot. Top: realistic iOS status bar. Below: iOS Notes navigation. Timestamp. Bold black serif headline "[HEADLINE like In Just [DOSAGE] A Day]". Below: benefit rows with checkmarks + emojis: "[BENEFIT 1-3]" using food-equivalency format. Right side: [YOUR PRODUCT] at slight angle with details spilling out. Clean white background. 1:1 aspect ratio.`
  },
  {
    id: 35,
    name: 'Hero Product Showcase + Stat Bar',
    nameEs: 'Showcase de Producto Hero + Stats',
    emoji: '🌟',
    category: 'lifestyle',
    description: 'Product showcase with scattered elements and stat bar.',
    descriptionEs: 'Showcase de producto con elementos dispersos y barra de estadísticas.',
    prompt: `Use the attached images as brand reference. Match the exact product design precisely. Create: a product showcase ad on [BACKGROUND COLOR] background. Top: large bold uppercase headline: "[SUPERLATIVE CLAIM]". Below: white CTA button "[CTA]". Center: [YOUR PRODUCT] hero-lit with studio lighting. Surrounding: [SCATTERED ELEMENTS] in exploded/radial pattern. Bottom: white stat bar with three metrics: "[STAT 1]" | "[STAT 2]" | "[STAT 3]". Numbers large and dominant. 1:1 aspect ratio.`
  },
  {
    id: 36,
    name: 'Whiteboard Before / After',
    nameEs: 'Pizarra Antes / Después',
    emoji: '🪧',
    category: 'ugc',
    description: 'Real-looking whiteboard illustration + product in hand.',
    descriptionEs: 'Ilustración de pizarra real + producto en mano.',
    prompt: `Use the attached images as brand reference for product packaging ONLY. Create: a lifestyle photo in [SETTING like bright kitchen]. Background: small tabletop whiteboard with two hand-drawn marker illustrations — left "[BEFORE LABEL]" showing [BEFORE STATE], arrow pointing to right "[AFTER LABEL]" showing [AFTER STATE]. Below drawings: handwritten CTA "[HANDWRITTEN CTA]". Foreground: person's hand holding [YOUR PRODUCT] next to whiteboard. Shot on iPhone, natural lighting, casual and educational. 4:5 aspect ratio.`
  },
  {
    id: 37,
    name: 'Hero Statement + Promo Burst',
    nameEs: 'Declaración Hero + Promo',
    emoji: '💥',
    category: 'promo',
    description: 'Hero statement with discount starburst and benefit icons.',
    descriptionEs: 'Declaración hero con estrella de descuento e íconos de beneficios.',
    prompt: `Use the attached images as brand reference. Match the exact product design precisely. Create: a promotional variant on [DARK BACKGROUND]. Top: white banner with massive bold headline: "[PROVOCATIVE STATEMENT]". Upper-left: [ACCENT COLOR] comic-style starburst badge "GET UP TO [DISCOUNT] OFF". Center: person's hand gripping [YOUR PRODUCT] from above. Moody lighting. Bottom: three icon-and-text benefit columns. Very bottom: full-width [ACCENT COLOR] banner with "[PROMO like BLACK FRIDAY SPECIAL]". 1:1 aspect ratio.`
  },
  {
    id: 38,
    name: 'UGC Lifestyle + Review Card',
    nameEs: 'UGC Lifestyle + Tarjeta de Reseña',
    emoji: '☕',
    category: 'social-proof',
    description: 'Vertical split — casual UGC photo left, brand + review right.',
    descriptionEs: 'División vertical — foto UGC izquierda, marca + reseña derecha.',
    prompt: `Use the attached images as brand reference. Match the exact product design precisely. Create: a vertical split social proof ad. Left 55%: casual UGC-style photo of [PERSON] enjoying the product — [ACTION]. Natural lighting, warm, iPhone-quality. Right 45%: solid [BRAND COLOR] background. Sparkle accents. [YOUR PRODUCT] at slight angle. Below: white review card with five filled stars and italic quote: "[SHORT REVIEW QUOTE]". Bottom: [BRAND LOGO] in white. 4:5 aspect ratio.`
  },
  {
    id: 39,
    name: 'Curiosity Gap / Scroll-Stopper',
    nameEs: 'Gancho de Curiosidad / Scroll-Stopper',
    emoji: '🛑',
    category: 'editorial',
    description: 'Truncated social caption + attention-grabbing problem photo.',
    descriptionEs: 'Caption social truncado + foto de problema que llama la atención.',
    prompt: `Use the attached images as brand reference for visual tone ONLY. Do NOT include product, logo, or branding. Create: a scroll-stopping curiosity ad. Top 35%: white background with large bold black text: "[HOOK HEADLINE like Most people don't realize THIS is why...]" followed by "...more" in lighter gray. Bottom 65%: close-up attention-grabbing photo of [PROBLEM VISUAL]. Slightly shallow depth of field. No text on photo. No product. No logo. No CTA. Designed to provoke curiosity. 1:1 aspect ratio.`
  },
  {
    id: 40,
    name: 'Post-It Note Style (Native)',
    nameEs: 'Estilo Post-It (Nativo)',
    emoji: '📌',
    category: 'ugc',
    description: 'Casual product photo with handwritten Post-It note. Feels found.',
    descriptionEs: 'Foto casual de producto con Post-It escrito a mano. Se siente encontrada.',
    prompt: `Use the attached images as brand reference. Match the exact product design precisely. Create: a lifestyle product photo in [REAL-LIFE SETTING] with [LIGHTING]. Slightly off-center, slightly cropped — feels found rather than composed. Slight natural grain. Center: [YOUR PRODUCT] on [SURFACE], slightly angled. [SCATTERED DETAILS] around base. Stuck on product: a yellow Post-It note, slightly crooked, realistic paper texture with crease. Held by tape. Handwritten in thick black marker, imperfect: "[LINE 1]" / "[LINE 2]" / "[LINE 3]" / "[LINE 4]". Bottom: small plain lowercase caption "[brand url] — [casual caption]". No logo overlay. Brand identity from product packaging only. 4:5 aspect ratio.`
  },
]

// Get templates by category
export function getTemplatesByCategory(category: string): AdTemplate[] {
  return AD_TEMPLATES.filter(t => t.category === category)
}

// Get all categories
export function getCategories(): { id: string; name: string; nameEs: string; count: number }[] {
  const cats = [
    { id: 'text', name: 'Text & Headlines', nameEs: 'Texto y Titulares' },
    { id: 'social-proof', name: 'Social Proof', nameEs: 'Prueba Social' },
    { id: 'comparison', name: 'Comparisons', nameEs: 'Comparaciones' },
    { id: 'ugc', name: 'UGC / Native', nameEs: 'UGC / Nativo' },
    { id: 'editorial', name: 'Editorial / Press', nameEs: 'Editorial / Prensa' },
    { id: 'data', name: 'Data & Stats', nameEs: 'Datos y Estadísticas' },
    { id: 'lifestyle', name: 'Lifestyle', nameEs: 'Estilo de Vida' },
    { id: 'promo', name: 'Promotions', nameEs: 'Promociones' },
  ]
  return cats.map(c => ({ ...c, count: AD_TEMPLATES.filter(t => t.category === c.id).length }))
}
