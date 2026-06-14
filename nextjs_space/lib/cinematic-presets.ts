// ============================================
// CINEMATIC DIRECTOR PRESETS
// 11 templates de tomas épicas Seedance 2.0 Pro
// + Chip options para Custom Builder
// ============================================
//
// Filosofía:
// - 6-section structure: Visual Style → Environment → Characters → VFX → Shot Sequence → Final Frame
// - Filter-compliant: no celebrity names, no franchise names, no violent words
// - Placeholders: {{user_brand}}, {{user_product}}, {{user_avatar}}
// - Pro tip vocabulary: Arri Alexa Mini, anamorphic, cinemascope, motion blur
// ============================================

export type CinematicCategory = 'video' | 'product_mockup'

export interface CinematicPreset {
  id: string
  emoji: string
  /** Short English title shown on card */
  name: string
  /** Spanish description shown below title */
  description: string
  /** Spanish marketing tagline */
  tagline: string
  /** Recommended duration in seconds. null = static product mockup (no video) */
  duration: number | null
  /** Aspect ratio hint */
  aspect: '9:16' | '16:9' | '2.39:1' | '1:1' | '4:5'
  category: CinematicCategory
  /** Difficulty/intensity level */
  intensity: 'cinematic' | 'epic' | 'minimalist'
  /** The base template that the LLM will adapt with user data */
  template: string
  /** Color/style hint shown on card */
  vibe: string
  /** Recommended Seedance model */
  recommendedModel: 'seedance_2_0' | 'seedance_2_0_fast' | 'seedance_1_5_pro' | 'static_image'
}

export const CINEMATIC_PRESETS: CinematicPreset[] = [
  // ─── GROUP A: Brand Video Campaigns (5 epic Seedance 2.0 prompts) ───
  {
    id: 'liquid_scan_reveal',
    emoji: '🌊',
    name: 'Liquid Scan Reveal',
    description: 'Cámara estática, escaneo 3D del entorno, producto se transforma en mercurio líquido y vuelve a su forma',
    tagline: 'El escaneo que hipnotiza — entorno se reorganiza, producto fluye como mercurio y regresa',
    duration: 15,
    aspect: '9:16',
    category: 'video',
    intensity: 'epic',
    vibe: '✨ Hyper-cinematic · Liquid metal · 3D scan',
    recommendedModel: 'seedance_2_0',
    template: `[VISUAL STYLE]
High-end editorial cinematic 4K frame, anamorphic lens flares, 35mm film grain, deep contrast, monochromatic palette breaks into one accent color matching the {{user_product}}. Aspect ratio 9:16 vertical.

[ENVIRONMENT]
Minimalist studio space with dark concrete floor and floating geometric architecture. Soft volumetric haze. The space appears to be made of digital wireframe that solidifies into reality.

[CHARACTERS]
{{user_avatar}} — exact face, hair, body and outfit must remain identical throughout. Subject stands in the center of the frame wearing the {{user_product}}.

[VFX]
A bright cyan scan line travels horizontally across the frame, revealing 3D wireframe of the environment. As it passes, the {{user_product}} transforms into liquid mercury, droplets float upward, then snap back into the original product form with a subtle metallic ripple.

[SHOT SEQUENCE]
[0-3s] Static wide shot. Scan line enters from left, environment morphs from wireframe to fully rendered editorial cinematic frame.
[3-8s] Camera locked. {{user_product}} dissolves into liquid mercury, droplets levitate around subject in slow motion.
[8-13s] Mercury reverses, droplets fly back, product reforms with metallic shimmer. Subject blinks naturally.
[13-15s] Hold on final frame. Subtle particle ambient.

[FINAL FRAME]
Subject confident pose, {{user_product}} pristine, single accent color glows softly. Logo {{user_brand}} fades in bottom-center. Camera does not move at any point.`,
  },
  {
    id: 'five_clip_outfit_build',
    emoji: '👕',
    name: '5-Clip Outfit Build',
    description: 'Cámara estática, 5 clips encadenados, cada prenda aparece sobre el modelo en sucesión rápida',
    tagline: 'Outfit completo en 5 takes — cada prenda se materializa con corte musical',
    duration: 15,
    aspect: '9:16',
    category: 'video',
    intensity: 'epic',
    vibe: '⚡ Multi-clip · Stop-motion fashion · Beat drops',
    recommendedModel: 'seedance_2_0',
    template: `[VISUAL STYLE]
High-fashion editorial cinematography, vertical 9:16, crisp color grading with deep shadows. Each clip shares identical lighting and framing for seamless cuts. Subtle motion blur on transitions.

[ENVIRONMENT]
Clean studio backdrop with seamless gradient (charcoal to deep teal). Single key light from camera-left, soft fill from camera-right.

[CHARACTERS]
{{user_avatar}} — exact same face, hair, body, pose and stance throughout all 5 clips. Subject stands centered, looking directly at camera with neutral confident expression.

[VFX]
Quick cut transitions with a flash of white frame between each clip. Subtle particle dust on each garment reveal. Color grade subtly intensifies with each addition.

[SHOT SEQUENCE]
[0-3s] Clip 1: Subject wears base layer only ({{user_product}} item 1). Static medium shot.
[3-6s] Cut. Clip 2: Same pose, now also wearing item 2. White flash transition.
[6-9s] Cut. Clip 3: Same pose, item 3 added. Slight smile begins.
[9-12s] Cut. Clip 4: Same pose, item 4 added. Subject begins to feel powerful.
[12-15s] Clip 5: Full outfit complete, subject takes one confident step forward, looks directly into lens.

[FINAL FRAME]
Full outfit visible head-to-toe, hero pose, {{user_brand}} logo appears bottom-right with soft fade-in. Camera locked throughout — only subject moves between cuts.`,
  },
  {
    id: 'cloud_levitation',
    emoji: '☁️',
    name: 'Cloud Levitation',
    description: 'Wire-work handheld, golden hour, modelo flota entre nubes con outfit en cámara lenta',
    tagline: 'Vuelo etéreo entre nubes doradas — outfit como divinidad moderna',
    duration: 15,
    aspect: '9:16',
    category: 'video',
    intensity: 'epic',
    vibe: '☁️ Golden hour · Ethereal · Slow-mo wire work',
    recommendedModel: 'seedance_2_0',
    template: `[VISUAL STYLE]
Dreamy editorial cinematic frame, golden hour color grading, anamorphic bokeh, soft volumetric god rays. Subtle slow-motion at 60fps feel. Aspect ratio 9:16.

[ENVIRONMENT]
Vast cloudscape at golden hour — orange, pink and lavender clouds stretch infinitely. Subject is suspended in mid-air, surrounded by floating cumulus clouds with glowing edges.

[CHARACTERS]
{{user_avatar}} — exact face, hair and body throughout. Subject wears the full {{user_product}} outfit. Hair flows naturally with imaginary wind. Expression is serene, eyes occasionally close as if at peace.

[VFX]
Slow-mo cloud particles flow past subject. Gentle wind ripples through fabric. Tiny golden light specks float upward around subject. No supernatural effects — keep grounded and credible.

[SHOT SEQUENCE]
[0-4s] Handheld cinematography slowly orbits subject from below to side. Wide shot, subject silhouetted against sun.
[4-9s] Camera glides upward to eye-level. Subject opens eyes, hair flows, fabric of {{user_product}} catches light.
[9-13s] Subject extends one arm slowly, fingers brush past a cloud, particles disperse. Camera holds at medium shot.
[13-15s] Subject closes eyes, peaceful smile, sunlight hits {{user_product}} highlighting key details.

[FINAL FRAME]
Medium close-up, subject illuminated by golden light, {{user_product}} key feature prominent. {{user_brand}} logo fades in upper-left in elegant serif. Single subtle wind sound.`,
  },
  {
    id: 'dimension_cuts',
    emoji: '🌀',
    name: 'Dimension Cuts',
    description: 'Cinemascope 2.39:1, cortes pixel-sharp entre 6 universos paralelos, mismo modelo en cada uno',
    tagline: '6 universos, 1 modelo — saltos rectangulares entre dimensiones',
    duration: 15,
    aspect: '2.39:1',
    category: 'video',
    intensity: 'epic',
    vibe: '🌀 Cinemascope · Multiverse · Rectangular cuts',
    recommendedModel: 'seedance_2_0',
    template: `[VISUAL STYLE]
Cinemascope 2.39:1 anamorphic widescreen, editorial cinematic frame, distinct color grade per location, motion-control precision cuts. Each cut uses a sharp rectangular wipe transition (not crossfade).

[ENVIRONMENT]
Six distinct locations, each visited briefly:
1. Neon-lit cyberpunk alley with rain reflections
2. Brutalist concrete rooftop at dusk
3. Misty forest with shafts of sunlight
4. Underground subway tunnel with sodium lighting
5. Desert dunes at golden hour
6. Mirror-walled studio infinity room

[CHARACTERS]
{{user_avatar}} — exact face, hair, body and outfit throughout. Subject wears {{user_product}} consistently across every cut. Pose changes per location to fit the mood.

[VFX]
Each cut transition is a clean rectangular pixel-sharp wipe (not crossfade). A subtle digital glitch frame between locations. Audio crossfade.

[SHOT SEQUENCE]
[0-2.5s] Location 1: Subject walks toward camera through neon alley.
[2.5-5s] Cut. Location 2: Subject pose against concrete skyline.
[5-7.5s] Cut. Location 3: Subject pause in forest, light hits face.
[7.5-10s] Cut. Location 4: Subject leans against subway tile wall.
[10-12.5s] Cut. Location 5: Subject in desert, hair blown by wind.
[12.5-15s] Final cut. Location 6: Subject in mirror room, infinite reflections of {{user_product}}.

[FINAL FRAME]
Mirror room reveals dozens of subject reflections wearing {{user_product}}. {{user_brand}} logo appears center, framed by reflections. Audio fades.`,
  },
  {
    id: 'tv_spot_invert',
    emoji: '⚫',
    name: 'TV Spot Invert',
    description: 'Monocromo + flashes negativos, solo el outfit conserva color, alta tensión publicitaria',
    tagline: 'Mundo en monocromo, outfit explota en color — anuncio TV vintage',
    duration: 12,
    aspect: '9:16',
    category: 'video',
    intensity: 'cinematic',
    vibe: '⚫ Monochrome · Color isolation · TV vintage',
    recommendedModel: 'seedance_2_0',
    template: `[VISUAL STYLE]
High-contrast monochrome (black and white) cinematography with one element preserving color: only the {{user_product}} retains its real color. Subtle film grain, vintage TV scanline overlay, occasional negative-flash frames. Aspect 9:16.

[ENVIRONMENT]
Urban downtown street at night, wet asphalt, distant blurry traffic lights (all desaturated to grayscale). Single overhead streetlight casting hard shadows.

[CHARACTERS]
{{user_avatar}} — exact face, hair, body. Skin and clothing rendered in pure black and white EXCEPT {{user_product}} which keeps full vibrant color (only colored object on screen).

[VFX]
Brief 1-frame negative-image flashes at beats. Subtle CRT scanline overlay. Light vignette pulsing with audio beats. Occasional analog TV interference at edges.

[SHOT SEQUENCE]
[0-3s] Wide shot, subject walks toward camera, slow-mo, monochrome except colored {{user_product}} pops.
[3-6s] Negative flash. Cut to medium shot, subject stops, looks at camera.
[6-9s] Negative flash. Close-up on {{user_product}} detail, only colored element on screen.
[9-12s] Pull back to wide shot, subject continues walking past camera with confident gait.

[FINAL FRAME]
Freeze on confident hero pose. {{user_brand}} logo appears in retro TV-style block letters with vintage chromatic aberration. Audio cuts to vinyl crackle.`,
  },

  // ─── GROUP B: Product Mockup Static (6 templates — Image API, no video) ───
  {
    id: 'jersey_flat_lay',
    emoji: '🏈',
    name: 'Athletic Jersey Flat Lay',
    description: 'Jersey flat lay sobre fondo neutro, malla poliéster, paneles raglán, tipografía editorial',
    tagline: 'Mockup deportivo de catálogo — flat lay con detalle de tejido',
    duration: null,
    aspect: '4:5',
    category: 'product_mockup',
    intensity: 'minimalist',
    vibe: '🏈 Flat lay · Polyester mesh · Editorial',
    recommendedModel: 'static_image',
    template: `High-end editorial flat lay frame of an athletic jersey from {{user_brand}}.

[STYLE]
Professional editorial catalog frame, top-down 90° angle, soft diffused studio lighting from above, no harsh shadows. Aspect ratio 4:5 vertical.

[BACKGROUND]
Matte neutral concrete or paper background in warm gray tone.

[PRODUCT DETAIL]
{{user_product}} laid perfectly flat. Polyester athletic mesh texture clearly visible at thread-level detail. Raglan-cut sleeve panels visible. Crew or v-neck collar pristine. Bold serif italic team typography on chest. Small {{user_brand}} logo on right chest. Stitching crisp, no wrinkles.

[COMPOSITION]
Jersey centered. Negative space around. No props. Camera locked perfectly straight overhead.

[FINAL]
Clean editorial mockup ready for catalog or e-commerce listing. Pixel-sharp focus on fabric texture.`,
  },
  {
    id: 'bomber_back_front',
    emoji: '🧥',
    name: 'Bomber Front + Back',
    description: 'Bomber lima/negro, vista frontal + trasera lado a lado, logo brushstroke',
    tagline: 'Doble vista de bomber — front + back en un solo frame',
    duration: null,
    aspect: '16:9',
    category: 'product_mockup',
    intensity: 'minimalist',
    vibe: '🧥 Side-by-side · Lime accent · Editorial',
    recommendedModel: 'static_image',
    template: `High-end editorial studio frame of a premium bomber jacket from {{user_brand}}.

[STYLE]
Clean editorial catalog frame, two views side-by-side in 16:9: front view on left, back view on right. Equal lighting, equal scale. Soft diffused studio softbox lighting.

[BACKGROUND]
Seamless paper backdrop in warm off-white.

[PRODUCT DETAIL]
{{user_product}} bomber jacket. Body in deep black, ribbed cuffs and hem in vibrant lime green. Brushstroke-style {{user_brand}} logo embroidered on left chest (front view) and across back shoulders (back view). YKK-style metal zipper. Side slip pockets visible. Smooth nylon outer fabric with subtle satin sheen.

[COMPOSITION]
Both views floating slightly above surface (subtle drop shadow). Equal margins. No mannequin — ghost mannequin / invisible mannequin technique so jacket holds its shape but no body visible.

[FINAL]
Professional e-commerce product hero. Tack-sharp focus on stitching, zipper teeth, and embroidery detail.`,
  },
  {
    id: 'sneaker_quad_view',
    emoji: '👟',
    name: 'Trail Sneaker 4-View',
    description: 'Grid 2x2: lateral, top-down, talón, suela. Cage lacado, cordones bungee',
    tagline: '4 ángulos del sneaker en una sola imagen — catalog hero',
    duration: null,
    aspect: '1:1',
    category: 'product_mockup',
    intensity: 'minimalist',
    vibe: '👟 4-view grid · Glossy cage · Trail aesthetic',
    recommendedModel: 'static_image',
    template: `High-end editorial studio frame for sneaker product for {{user_brand}}.

[STYLE]
2x2 grid composition in 1:1 square aspect ratio. Each quadrant shows a different view of the same sneaker, on identical neutral background, with identical lighting. Premium catalog cinematography.

[GRID LAYOUT]
Top-left: Lateral profile view (side)
Top-right: Top-down view (90° from above)
Bottom-left: Heel/back view
Bottom-right: Outsole view (sole pattern visible)

[BACKGROUND]
Matte cool gray seamless backdrop, identical across all 4 quadrants.

[PRODUCT DETAIL]
{{user_product}} trail sneaker. Glossy lacquered TPU cage in deep midnight blue. Bungee-style elastic laces with metal pull tab. Aggressive trail rubber outsole pattern visible in bottom-right. Tongue label with embossed {{user_brand}} mark. Mesh underlay in lighter blue gradient.

[COMPOSITION]
Thin separator line between quadrants. Equal spacing. Each shoe fills 80% of its quadrant. Sharp pixel-level detail.

[FINAL]
Professional 4-view catalog mockup ready for product detail page.`,
  },
  {
    id: 'parachute_pants_top',
    emoji: '👖',
    name: 'Parachute Pants Top-Down',
    description: 'Pantalón parachute crinkle nylon, top-down, ribete lima, logo X-circle',
    tagline: 'Pant flat lay con textura crinkle nylon — detalle de catálogo',
    duration: null,
    aspect: '4:5',
    category: 'product_mockup',
    intensity: 'minimalist',
    vibe: '👖 Crinkle nylon · Top-down · Lime piping',
    recommendedModel: 'static_image',
    template: `High-end editorial flat lay frame for {{user_brand}}.

[STYLE]
Top-down 90° editorial catalog frame, aspect ratio 4:5 vertical. Soft diffused overhead lighting, minimal shadows.

[BACKGROUND]
Warm gray paper seamless backdrop.

[PRODUCT DETAIL]
{{user_product}} parachute pants. Crinkle nylon fabric with visible texture (papery wrinkled finish). Color: deep technical black. Lime-green piping along outer leg seam. Adjustable elastic ankle cuffs with toggle. Drawstring waist with metal aglets. Circular {{user_brand}} X-logo patch on left thigh.

[COMPOSITION]
Pants laid completely flat, legs straight, slight overlap of fabric showing crinkle. Centered. Negative space around.

[FINAL]
Editorial-quality flat lay. Pixel-sharp focus on crinkle nylon texture and lime piping detail.`,
  },
  {
    id: 'shield_sunglasses',
    emoji: '🕶️',
    name: 'Shield Sunglasses Dual',
    description: 'Sunglasses wraparound, vista frontal + 3/4, lentes espejados',
    tagline: 'Lentes shield en doble ángulo — front + 3/4 hero',
    duration: null,
    aspect: '16:9',
    category: 'product_mockup',
    intensity: 'minimalist',
    vibe: '🕶️ Dual angle · Mirror lenses · Wraparound',
    recommendedModel: 'static_image',
    template: `High-end editorial studio frame for {{user_brand}}.

[STYLE]
Two views side-by-side in 16:9: front straight-on view on left, three-quarter angle view on right. Pristine product cinematography.

[BACKGROUND]
Soft gradient backdrop transitioning from charcoal at top to cool gray at bottom.

[PRODUCT DETAIL]
{{user_product}} shield-style wraparound sunglasses. Single-lens panoramic shield design with mirror finish (subtle iridescent purple-to-teal gradient on lens reflection). Black matte temples (arms) with {{user_brand}} logo etched subtly. Adjustable nose pads. No frame on top of lens.

[COMPOSITION]
Front view perfectly symmetrical. Three-quarter view shows side profile and depth of shield. Floating shadow beneath.

[FINAL]
Luxury eyewear hero shot. Pixel-sharp focus on lens iridescence and frame stitching detail.`,
  },
  {
    id: 'cosmos_box_bag',
    emoji: '📦',
    name: 'Cosmos Box + Bag',
    description: 'Caja de marca + bolsa shopping juntas sobre fondo negro, key art',
    tagline: 'Packaging hero — caja y bolsa juntas, alta gama',
    duration: null,
    aspect: '1:1',
    category: 'product_mockup',
    intensity: 'minimalist',
    vibe: '📦 Black backdrop · Premium packaging · Key art',
    recommendedModel: 'static_image',
    template: `High-end editorial luxury packaging frame for {{user_brand}}.

[STYLE]
Dark studio key-art aesthetic, square 1:1 aspect ratio. Single rim-light from upper-left, deep shadows on right. Cinematic moodiness.

[BACKGROUND]
Deep matte black studio floor, slight haze. No props.

[PRODUCT DETAIL]
{{user_product}} packaging set: a premium cardboard box with embossed {{user_brand}} logo, deep velvety matte finish, and beside it a structured shopping bag with rope handles, same logo treatment, and subtle iridescent foil edge.

[COMPOSITION]
Box centered slightly left, bag standing upright behind and right. Both products within frame, leaving 20% negative space around. Rim light catches the embossed logo creating subtle highlight.

[FINAL]
Luxury packaging hero shot. Tack-sharp focus on embossing, foil details, paper texture. Mood: premium, exclusive.`,
  },
]

// ============================================
// CUSTOM BUILDER CHIP OPTIONS
// ============================================

export interface CinematicChip {
  id: string
  emoji: string
  label: string
  hint: string
}

export const CAMERA_ANGLES: CinematicChip[] = [
  { id: 'static_locked', emoji: '🎥', label: 'Static Locked', hint: 'Cámara fija, sin movimiento' },
  { id: 'handheld', emoji: '📹', label: 'Handheld', hint: 'Movimiento orgánico de mano' },
  { id: 'low_angle_hero', emoji: '👇', label: 'Low Angle Hero', hint: 'Plano contrapicado heroico' },
  { id: 'overhead_topdown', emoji: '⬇️', label: 'Top-Down', hint: '90° cenital' },
  { id: 'dolly_in', emoji: '➡️', label: 'Dolly In', hint: 'Acercamiento sobre rieles' },
  { id: 'orbital_360', emoji: '🔄', label: 'Orbital 360°', hint: 'Cámara orbita al sujeto' },
  { id: 'crane_descent', emoji: '🪂', label: 'Crane Descent', hint: 'Cámara desciende desde arriba' },
  { id: 'first_person_pov', emoji: '👁️', label: 'First-Person POV', hint: 'Vista subjetiva del sujeto' },
]

export const LIGHTING_SETUPS: CinematicChip[] = [
  { id: 'golden_hour', emoji: '🌅', label: 'Golden Hour', hint: 'Luz cálida del atardecer' },
  { id: 'studio_softbox', emoji: '💡', label: 'Studio Softbox', hint: 'Luz blanda profesional' },
  { id: 'neon_cyberpunk', emoji: '🌃', label: 'Neon Cyberpunk', hint: 'Neón violeta + cyan' },
  { id: 'volumetric_haze', emoji: '🌫️', label: 'Volumetric Haze', hint: 'Niebla con rayos de luz' },
  { id: 'hard_directional', emoji: '☀️', label: 'Hard Directional', hint: 'Sombras duras dramáticas' },
  { id: 'ambient_overcast', emoji: '☁️', label: 'Overcast', hint: 'Luz difusa nublada' },
]

export const MOOD_VIBES: CinematicChip[] = [
  { id: 'epic_heroic', emoji: '🦅', label: 'Epic Heroic', hint: 'Heroico, épico, poderoso' },
  { id: 'minimal_clean', emoji: '⬜', label: 'Minimal Clean', hint: 'Limpio, editorial, refinado' },
  { id: 'gritty_urban', emoji: '🏙️', label: 'Gritty Urban', hint: 'Urbano crudo, autenticidad' },
  { id: 'dreamy_ethereal', emoji: '✨', label: 'Dreamy Ethereal', hint: 'Onírico, etéreo, mágico' },
  { id: 'tech_futuristic', emoji: '🤖', label: 'Tech Futuristic', hint: 'Futurista, sci-fi, hi-tech' },
  { id: 'warm_intimate', emoji: '🔥', label: 'Warm Intimate', hint: 'Cálido, íntimo, cercano' },
]

export function getPreset(id: string): CinematicPreset | undefined {
  return CINEMATIC_PRESETS.find(p => p.id === id)
}

export function getVideoPresets(): CinematicPreset[] {
  return CINEMATIC_PRESETS.filter(p => p.category === 'video')
}

export function getProductMockupPresets(): CinematicPreset[] {
  return CINEMATIC_PRESETS.filter(p => p.category === 'product_mockup')
}
