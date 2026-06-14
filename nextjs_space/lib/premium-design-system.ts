// ═══════════════════════════════════════════════════════════════════════════════
// 💎 PREMIUM DESIGN SYSTEM — Fuente de verdad ÚNICA del lenguaje visual de alta gama
// ───────────────────────────────────────────────────────────────────────────────
// Extraído de §11–§14 del Code Engine (tokens de color/tipografía, glassmorphism,
// catálogo de motion, blueprints de componentes, doctrina responsive + grid).
//
// Lo consumen DOS motores: el Code Engine (lib/claude-code-prompts.ts) y el
// generador de landings Octopus Canvas (lib/octopus-canvas.ts). Editar aquí mejora
// AMBOS a la vez — sin duplicación, sin drift. Módulo standalone (cero imports de
// servidor) para que siga siendo importable desde cliente y servidor.
// ═══════════════════════════════════════════════════════════════════════════════

export const PREMIUM_DESIGN_SYSTEM = `
§11 — PREMIUM DESIGN SYSTEM (Apple/Tesla DNA)
═══════════════════════════════════════════════════════════════════════════════

Every website you produce must feel like a $100K agency build.
Your design DNA is extracted from Apple, Tesla, and top-tier agencies.
Below are EXACT recipes — use the specific values, not approximations.

┌─────────────────────────────────────────────────────────────────┐
│ 11.1 — COLOR SYSTEM (4 base colors + opacity token system)     │
└─────────────────────────────────────────────────────────────────┘

STRUCTURE: 4 base hex colors + unlimited opacity/tint variants as CSS custom properties.
Always declare in :root { } as a token system:

DARK THEMES:
- --bg: #050510 | #0a0a1a | #051A24 | #070b0a | #010101 (NEVER pure #000)
- --text: #F6FCFF | #FFFFFF
- --text-muted: rgba(255,255,255,0.60-0.70)
- --accent: one vibrant brand color (hex)
- CARD SURFACES (non-glass): rgba(255,255,255,0.02-0.05) with border rgba(255,255,255,0.06-0.10)
- GLASS CARDS: use §11.3 recipes (.glass, .glass-strong, .glass-liquid) — these have HIGHER opacity than regular cards. This is intentional, not a conflict.
- Accent opacity tokens: --accent-5: rgba(ACCENT,0.05); --accent-10: rgba(ACCENT,0.10); --accent-20: rgba(ACCENT,0.20); etc.
- Section depth: alternate sections get radial-gradient(ellipse at 30% 50%, var(--accent-5) 0%, transparent 70%)

LIGHT THEMES:
- --bg: #FFFFFF | #F5F5F5 (NEVER pure white with no contrast)
- --text: #0D212C | #051A24
- --text-muted: rgba(PRIMARY,0.60-0.70)
- --accent: one vibrant brand color (hex)
- Card surfaces: white with box-shadow: 0 4px 16px rgba(0,0,0,0.08)
- Section depth: alternating white/#F8F9FA backgrounds

GRADIENT TEXT (for hero headlines on dark themes):
background: linear-gradient(135deg, #fff 0%, ACCENT_1 50%, ACCENT_2 100%);
-webkit-background-clip: text; -webkit-text-fill-color: transparent;

INDUSTRY COLOR PALETTES (use when user doesn't specify colors):
- SaaS / Tech:      bg #050510, accent #6C63FF (electric violet), secondary #00D4AA
- Fintech / Banking: bg #051A24, accent #00E5A0 (mint), secondary #0EA5E9
- E-commerce:       bg #0C0C0C, accent #FF6B35 (coral), secondary #FFD700
- Healthcare:       bg #0A1628, accent #00B4D8 (cerulean), secondary #34D399
- Real Estate:      bg #0D1117, accent #C9A96E (gold), secondary #F5F5F5
- Creative Agency:  bg #0A0A0A, accent #FF3366 (neon pink), secondary #8B5CF6
- Education:        bg #0F172A, accent #3B82F6 (blue), secondary #F59E0B
- Food & Restaurant: bg #1A0A00, accent #FF8C00 (amber), secondary #EF4444
- Fitness / Sports: bg #0C0C0C, accent #22D3EE (cyan), secondary #F43F5E
- Legal / Corporate: bg #0D1B2A, accent #1B4965 (navy), secondary #BEE9E8
If user specifies industry but not colors, pick from this map. If user specifies colors, IGNORE this map.

┌─────────────────────────────────────────────────────────────────┐
│ 11.2 — TYPOGRAPHY SYSTEM (Max 3 fonts with assigned roles)      │
└─────────────────────────────────────────────────────────────────┘

Every project declares a CLOSED typography system:

FONT ROLES:
- PRIMARY: Headlines, hero text, brand presence (e.g., Inter 800, Rubik Bold, Fustat Bold)
- SECONDARY: Body text, descriptions, UI (e.g., Inter 400-500, Plus Jakarta Sans)
- ACCENT (optional): Serif or display for emphasis words (e.g., Instrument Serif Italic, PP Mondwest)

IMPORT METHOD — Always @font-face or Google Fonts with EXACT weights:
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

SCALE (use clamp for fluid responsive):
- Hero headline:    clamp(2.5rem, 5vw + 1rem, 5rem) or text-[40px] md:text-[64px] lg:text-[80px]
- Section title:    clamp(1.8rem, 3vw + 0.5rem, 3rem)
- Body:             16px, line-height 1.6
- Small/labels:     11-12px, uppercase, letter-spacing 0.1-0.15em, font-weight 600
- Eyebrow text:     11px, uppercase, letter-spacing 0.15em, color: accent

LETTER SPACING:
- Headlines: -0.02em to -0.04em (tight, modern fintech feel)
- Body: normal (0)
- Labels/badges: +0.10em to +0.15em (spaced, premium feel)

LINE HEIGHT:
- Headlines: 1.05 to 1.15 (tight)
- Body: 1.5 to 1.7 (readable)

FONT SMOOTHING (always include in body):
-webkit-font-smoothing: antialiased;
-moz-osx-font-smoothing: grayscale;

┌─────────────────────────────────────────────────────────────────┐
│ 11.3 — GLASSMORPHISM RECIPES                                    │
└─────────────────────────────────────────────────────────────────┘

STANDARD GLASS (for navbars, floating cards):
.glass {
  background: rgba(255,255,255,0.03);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255,255,255,0.08);
}

STRONG GLASS (for featured cards, premium navbars):
.glass-strong {
  background: rgba(255,255,255,0.30);
  backdrop-filter: blur(50px);
  -webkit-backdrop-filter: blur(50px);
  border: 1px solid rgba(0,0,0,0.10);
  box-shadow: inset 0px 4px 4px rgba(255,255,255,0.25);
}

LIQUID GLASS (for hero cards, premium overlays):
.glass-liquid {
  background: rgba(255,255,255,0.01);
  background-blend-mode: luminosity;
  backdrop-filter: blur(4px) saturate(180%);
  -webkit-backdrop-filter: blur(4px) saturate(180%);
  box-shadow: inset 0 1px 1px rgba(255,255,255,0.1);
  border: 1.4px solid rgba(255,255,255,0.12);
}

HEADER GLASS (scroll-reactive — ALWAYS implement):
const header = document.querySelector('header');
window.addEventListener('scroll', () => {
  header.classList.toggle('scrolled', window.scrollY > 50);
});
header.scrolled { border-bottom: 1px solid rgba(255,255,255,0.06); background: rgba(X,X,X,0.85); }

┌─────────────────────────────────────────────────────────────────┐
│ 11.4 — SHADOW SYSTEM (Layered, never flat)                      │
└─────────────────────────────────────────────────────────────────┘

CARD SHADOW (light theme):
box-shadow: 0 4px 16px rgba(0,0,0,0.08);

CARD SHADOW (dark theme):
box-shadow: 0 4px 24px rgba(0,0,0,0.4);

BUTTON SHADOW — PREMIUM TACTILE (6-layer):
box-shadow:
  0 1px 2px rgba(5,26,36,0.10),
  0 4px 4px rgba(5,26,36,0.09),
  0 9px 6px rgba(5,26,36,0.05),
  0 17px 7px rgba(5,26,36,0.01),
  0 26px 7px rgba(5,26,36,0.00),
  inset 0 2px 8px rgba(255,255,255,0.50);

BUTTON SHADOW — GLOW (for CTA on dark themes):
box-shadow: 0 0 40px rgba(ACCENT,0.35);

HOVER ELEVATION (mandatory for cards):
.card { transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
.card:hover { transform: translateY(-6px); box-shadow: 0 20px 60px rgba(0,0,0,0.3); }

┌─────────────────────────────────────────────────────────────────┐
│ 11.5 — BUTTON VARIANTS (exact CSS for each type)                │
└─────────────────────────────────────────────────────────────────┘

TYPE 1 — PILL CTA (rounded-full, primary action):
.btn-pill {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 14px 32px; border-radius: 9999px;
  background: VAR_ACCENT; color: #fff;
  font-weight: 600; font-size: 16px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.btn-pill:hover { transform: translateY(-2px); box-shadow: 0 0 40px rgba(ACCENT,0.4); }

TYPE 2 — PILL WITH ARROW CIRCLE (agency style):
Button text + trailing circle with ArrowRight icon inside.
.btn-arrow-circle {
  display: inline-flex; align-items: center; gap: 12px;
  padding: 8px 8px 8px 32px; border-radius: 9999px;
  background: VAR_BG; color: VAR_TEXT;
}
.btn-arrow-circle .icon-circle {
  width: 40px; height: 40px; border-radius: 50%;
  background: VAR_ACCENT; display: flex; align-items: center; justify-content: center;
}

TYPE 3 — GRADIENT CTA:
.btn-gradient {
  background: linear-gradient(135deg, ACCENT_1, ACCENT_2);
  border: none; border-radius: 50px; color: #fff;
  padding: 14px 32px; font-weight: 600;
}

TYPE 4 — GHOST/SECONDARY:
.btn-ghost {
  background: transparent; border: 1px solid rgba(255,255,255,0.15);
  color: rgba(255,255,255,0.8); border-radius: 9999px;
  padding: 12px 28px; backdrop-filter: blur(4px);
}

TYPE 5 — CLIP-PATH GEOMETRIC:
.btn-clip {
  clip-path: polygon(12px 0%, 100% 0%, calc(100% - 12px) 100%, 0% 100%);
  padding: 14px 32px; font-weight: 700; text-transform: uppercase;
}

┌─────────────────────────────────────────────────────────────────┐
│ 11.6 — INTERACTION STATES (all 4 states for EVERY button)       │
└─────────────────────────────────────────────────────────────────┘

EVERY button MUST define all 4 states. An Awwwards site never has undefined states.

:hover   — translateY(-2px) + shadow/glow (already in 11.5 types above)
:focus-visible — outline: 2px solid VAR_ACCENT; outline-offset: 3px; (keyboard users MUST see it)
:active  — transform: translateY(1px) scale(0.97); transition-duration: 0.1s; (tactile press)
:disabled — opacity: 0.4; pointer-events: none; cursor: not-allowed; filter: grayscale(30%);

Example for .btn-pill:
.btn-pill:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; box-shadow: 0 0 0 4px rgba(ACCENT, 0.15); }
.btn-pill:active { transform: translateY(1px) scale(0.97); box-shadow: 0 0 20px rgba(ACCENT, 0.2); }
.btn-pill:disabled { opacity: 0.4; pointer-events: none; cursor: not-allowed; }

ALSO apply :focus-visible to links and interactive cards (outline: 2px solid var(--accent), offset 2px).

═══════════════════════════════════════════════════════════════════════════════
§12 — MOTION CATALOG (Allowed animations with exact implementation)
═══════════════════════════════════════════════════════════════════════════════

RULE: Motion must have PURPOSE. It guides the eye, reveals content, creates depth.
NEVER: Random bouncing, spinning logos, everything moving at once, autoplay carousels without controls.

┌ SCROLL REVEAL (mandatory for all sections) ─────────────────────┐
@keyframes fadeInUp {
  0% { opacity: 0; transform: translateY(30px); }
  100% { opacity: 1; transform: translateY(0); }
}
.animate-on-scroll { opacity: 0; }
.animate-on-scroll.visible { animation: fadeInUp 0.8s ease-out forwards; }
— IntersectionObserver with threshold: 0.1, triggerOnce: true
— Stagger children with animation-delay: 0.1s, 0.2s, 0.3s increments

┌ INFINITE MARQUEE (for logos, brands, testimonials) ─────────────┐
@keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
.marquee-track { display: flex; width: max-content; animation: marquee VAR_SPEED linear infinite; }
— ALWAYS duplicate items (render array twice) for seamless loop
— Speed: 20-30s for logos, 10-15s for smaller elements
— pause on hover: .marquee-track:hover { animation-play-state: paused; }

┌ HERO PARTICLES (for dark premium heroes) ───────────────────────┐
@keyframes float {
  0%, 100% { transform: translateY(0px) rotate(0deg); opacity: VAR; }
  50% { transform: translateY(VAR_DIST) rotate(180deg); opacity: VAR_PEAK; }
}
— 15-20 divs, 2-6px, position: absolute in hero container
— random delay (0-10s), random duration (8-20s), translateY 30-80px
— colors: rgba(ACCENT_1,0.3) and rgba(ACCENT_2,0.2) alternating
— SKIP in FAST mode.

┌ PARALLAX IMAGE (for testimonials, hero images) ─────────────────┐
IntersectionObserver + scroll listener + requestAnimationFrame
Max offset: 100-200px vertical. Smooth. Never janky.

┌ TESTIMONIAL CAROUSEL (auto-scroll with controls) ──────────────┐
— Auto-scroll interval: 3-4s. PAUSE on hover.
— Prev/Next buttons: 48px circles, border 1px rgba(PRIMARY,0.20), centered arrows.
— Transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)
— Duplicate cards 3x for infinite scroll illusion.

┌ HOVER MICRO-INTERACTIONS ───────────────────────────────────────┐
— Cards: translateY(-6px) + elevated shadow, 0.4s cubic-bezier
— Buttons: translateY(-2px) + glow, 0.3s ease
— Links: opacity 0.7 transition, 0.2s
— Images: scale(1.03), 0.6s ease
— Nav links: color transition to accent, 0.2s

┌ LOADING STATES (skeleton, spinner, progress) ──────────────────┐

SKELETON LOADER (for content placeholder):
@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
.skeleton { background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%); background-size: 200% 100%; animation: shimmer 1.5s ease-in-out infinite; border-radius: var(--radius-md); }
.skeleton-text { height: 14px; margin-bottom: 8px; border-radius: 4px; }
.skeleton-title { height: 24px; width: 60%; margin-bottom: 16px; }
.skeleton-avatar { width: 48px; height: 48px; border-radius: 50%; }
.skeleton-card { height: 200px; border-radius: var(--radius-lg); }

SPINNER (for buttons and inline loading):
@keyframes spin { to { transform: rotate(360deg); } }
.spinner { width: 20px; height: 20px; border: 2px solid rgba(255,255,255,0.15); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.6s linear infinite; }
.spinner-lg { width: 40px; height: 40px; border-width: 3px; }
Use inside buttons: replace button text with spinner on loading. Set button to :disabled during loading.

PROGRESS BAR (for multi-step or upload):
.progress-bar { height: 4px; background: rgba(255,255,255,0.06); border-radius: var(--radius-full); overflow: hidden; }
.progress-fill { height: 100%; background: var(--accent); border-radius: var(--radius-full); transition: width 0.4s cubic-bezier(0.4,0,0.2,1); }
JS: function setProgress(el, pct) { el.querySelector('.progress-fill').style.width = pct + '%'; }

═══════════════════════════════════════════════════════════════════════════════
§13 — COMPONENT PATTERNS (Exact implementation blueprints)
═══════════════════════════════════════════════════════════════════════════════

┌ NAVBAR ─────────────────────────────────────────────────────────┐
Structure: Logo (left) | Links (center, hidden mobile) | CTA button (right)
Position: sticky or absolute, z-index: 50, top: 0 (or top: 30px for floating)
Desktop: flex items-center justify-between, max-width container
Mobile: hamburger icon → full-screen overlay (dark bg, centered links, close X)
Glass: backdrop-filter blur, semi-transparent bg, reactive to scroll

┌ HERO SECTION ───────────────────────────────────────────────────┐
Layout: centered narrow column (max-w-[600px]) OR split 2-col (text left, media right)
Content stack (top to bottom):
  1. Eyebrow/badge: 11px uppercase, letter-spacing 0.15em, accent color, pill bg optional
  2. Headline: largest text, tight line-height (1.05-1.15), negative letter-spacing
  3. Subheadline: 16-18px, text-secondary (60-70% opacity), max-w-[512px]
  4. CTA buttons: 1-2 buttons, gap-16px, primary + secondary variant
  5. Social proof (optional): star rating, customer count, or logo strip
Background: video (with overlay) OR gradient mesh OR solid with particles

┌ PRICING CARDS ──────────────────────────────────────────────────┐
Layout: grid 1-col mobile, 2-3 col desktop, gap-32px
Card anatomy:
  - rounded-[32px] to rounded-[40px] (generous, modern)
  - padding: 40px (or pl-40px pr-96px for asymmetric luxury)
  - Title: 22px, font-weight 500
  - Description: 14-16px, text-secondary
  - Price: largest in card (28-36px), with period below ("Monthly" / "Minimum")
  - CTA button: full or auto width
Dark variant: bg-[DARK_COLOR], light text
Light variant: bg-white, shadow: 0 4px 16px rgba(0,0,0,0.08)

┌ TESTIMONIAL CARDS ──────────────────────────────────────────────┐
Card: rounded-[32px], padding 32px (or asymmetric), shadow-light
Content: quote icon (SVG or Lucide) → quote text (16px, leading-relaxed) → author row
Author row: circular avatar (48px) + name (font-semibold, 14px) + role/company

┌ FOOTER ─────────────────────────────────────────────────────────┐
Keep SIMPLE. Max 3-4 link columns. No bloated mega-footers.
Structure: Logo/brand (left) | Link columns (right) | Copyright bar below
Links: 16px, color primary, hover opacity 0.7 transition

┌ PROJECT/PORTFOLIO CARDS ────────────────────────────────────────┐
Vertical stack or grid. Each item:
  - Text offset (margin-left for asymmetric elegance)
  - Project name in accent/serif font, 24-32px
  - Description: 14-16px, text-secondary (60-70% opacity)
  - Full-width image below: rounded-2xl, shadow-lg, object-cover

┌ FAQ ACCORDION (ready-to-use pattern) ──────────────────────────┐
HTML: <div class="faq-item"><button class="faq-q" aria-expanded="false">Question text <span class="faq-icon">+</span></button><div class="faq-a"><p>Answer text</p></div></div>
CSS:
.faq-item { border-bottom: 1px solid rgba(255,255,255,0.08); }
.faq-q { width: 100%; text-align: left; padding: var(--space-lg) 0; font-size: 18px; font-weight: 500; display: flex; justify-content: space-between; align-items: center; background: none; border: none; color: inherit; cursor: pointer; }
.faq-a { max-height: 0; overflow: hidden; transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), padding 0.3s ease; padding: 0; }
.faq-a.open { max-height: 500px; padding-bottom: var(--space-lg); }
.faq-icon { transition: transform 0.3s ease; font-size: 24px; }
.faq-item.active .faq-icon { transform: rotate(45deg); }
JS: querySelectorAll('.faq-q').forEach(btn => btn.addEventListener('click', () => { const item = btn.parentElement; const wasActive = item.classList.contains('active'); document.querySelectorAll('.faq-item').forEach(i => { i.classList.remove('active'); i.querySelector('.faq-a').classList.remove('open'); btn.setAttribute('aria-expanded','false'); }); if (!wasActive) { item.classList.add('active'); item.querySelector('.faq-a').classList.add('open'); btn.setAttribute('aria-expanded','true'); } }));

┌ PRICING TOGGLE MONTHLY/ANNUAL (ready-to-use pattern) ─────────┐
HTML: <div class="pricing-toggle"><span class="toggle-label" data-period="monthly">Mensual</span><button class="toggle-switch" role="switch" aria-checked="false"><span class="toggle-knob"></span></button><span class="toggle-label" data-period="annual">Anual <span class="toggle-badge">-20%</span></span></div>
CSS:
.pricing-toggle { display: flex; align-items: center; gap: var(--space-md); justify-content: center; margin-bottom: var(--space-xl); }
.toggle-switch { width: 56px; height: 28px; border-radius: var(--radius-full); background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15); position: relative; cursor: pointer; transition: background 0.3s; }
.toggle-knob { width: 22px; height: 22px; border-radius: 50%; background: var(--accent); position: absolute; top: 2px; left: 2px; transition: transform 0.3s cubic-bezier(0.4,0,0.2,1); }
.toggle-switch[aria-checked="true"] .toggle-knob { transform: translateX(28px); }
.toggle-switch[aria-checked="true"] { background: rgba(ACCENT,0.2); }
.toggle-badge { font-size: 11px; background: var(--accent); color: #fff; padding: 2px 8px; border-radius: var(--radius-full); }
.price-monthly, .price-annual { transition: opacity 0.3s, transform 0.3s; }
JS: const toggle = document.querySelector('.toggle-switch'); toggle.addEventListener('click', () => { const isAnnual = toggle.getAttribute('aria-checked') === 'true'; toggle.setAttribute('aria-checked', !isAnnual); document.querySelectorAll('.price-monthly').forEach(el => { el.style.display = isAnnual ? '' : 'none'; }); document.querySelectorAll('.price-annual').forEach(el => { el.style.display = isAnnual ? 'none' : ''; }); });

┌ FORM / CONTACT FORM (ready-to-use pattern — Web3Forms powered) ┐
CRITICAL: ALL contact/newsletter/lead forms MUST submit to Web3Forms.
The hidden access_key field uses the placeholder __WEB3FORMS_KEY__ — the system auto-injects the real key at build time.
NEVER invent a different form handler. NEVER leave /* handle submit */ empty.

HTML structure:
<form class="form-group" id="contact-form">
  <input type="hidden" name="access_key" value="__WEB3FORMS_KEY__" />
  <input type="hidden" name="subject" value="Nuevo mensaje desde tu sitio web" />
  <input type="hidden" name="from_name" value="Mi Landing Page" />
  <div class="input-wrap"><input type="text" name="name" id="name" placeholder=" " required /><label for="name">Nombre</label><span class="input-error">Ingresa tu nombre</span></div>
  <div class="input-wrap"><input type="email" name="email" id="email" placeholder=" " required /><label for="email">Email</label><span class="input-error">Ingresa un email válido</span></div>
  <div class="input-wrap"><textarea name="message" id="message" placeholder=" " rows="4" required></textarea><label for="message">Mensaje</label><span class="input-error">Escribe un mensaje</span></div>
  <button type="submit" class="btn-pill" id="form-submit-btn">Enviar <span class="spinner" style="display:none;margin-left:8px;"></span></button>
</form>
Adapt field names/labels to context (e.g. "Teléfono", "Empresa") but ALWAYS keep the access_key + subject hidden inputs.
Change the "from_name" value to match the site/business name. Change "subject" to describe the form purpose.
For newsletter forms, use fewer fields (just email) but ALWAYS include the access_key hidden input.

CSS — Floating labels + states:
.form-group { display: flex; flex-direction: column; gap: var(--space-lg); }
.input-wrap { position: relative; }
.input-wrap input, .input-wrap textarea {
  width: 100%; padding: 16px 20px; padding-top: 24px;
  background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.10);
  border-radius: var(--radius-md); color: var(--text); font-size: 16px;
  transition: border-color 0.3s, box-shadow 0.3s; outline: none;
}
.input-wrap label {
  position: absolute; top: 20px; left: 20px; font-size: 14px;
  color: var(--text-muted); pointer-events: none;
  transition: all 0.2s cubic-bezier(0.4,0,0.2,1);
}
.input-wrap input:focus, .input-wrap textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(ACCENT,0.10); }
.input-wrap input:focus + label, .input-wrap input:not(:placeholder-shown) + label,
.input-wrap textarea:focus + label, .input-wrap textarea:not(:placeholder-shown) + label {
  top: 6px; font-size: 11px; color: var(--accent); letter-spacing: 0.05em;
}
.input-error { display: none; font-size: 12px; color: #EF4444; margin-top: 4px; }
.input-wrap.error input { border-color: #EF4444; }
.input-wrap.error .input-error { display: block; }

JS — Validation + Web3Forms submission (MANDATORY — copy exactly):
document.getElementById('contact-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const btn = form.querySelector('#form-submit-btn');
  const spinner = btn.querySelector('.spinner');
  let valid = true;
  form.querySelectorAll('.input-wrap input[required], .input-wrap textarea[required]').forEach(inp => {
    const wrap = inp.closest('.input-wrap');
    if (!inp.value.trim() || (inp.type === 'email' && !/^[^@]+@[^@]+\\.[^@]+$/.test(inp.value))) {
      wrap.classList.add('error'); valid = false;
    } else { wrap.classList.remove('error'); }
  });
  if (!valid) return;
  btn.disabled = true; btn.style.opacity = '0.7';
  if (spinner) spinner.style.display = 'inline-block';
  try {
    const formData = new FormData(form);
    const obj = Object.fromEntries(formData);
    const res = await fetch('https://api.web3forms.com/submit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(obj)
    });
    const data = await res.json();
    if (data.success) {
      showToast('¡Mensaje enviado con éxito! 🎉', 'success');
      form.reset();
    } else { showToast('Error al enviar. Intenta de nuevo.', 'error'); }
  } catch (err) { showToast('Error de conexión. Verifica tu internet.', 'error'); }
  btn.disabled = false; btn.style.opacity = '1';
  if (spinner) spinner.style.display = 'none';
});
NOTE: showToast() is defined in the Toast pattern above — ALWAYS include the Toast HTML+CSS+JS when using forms.

┌ COMPARISON TABLE (ready-to-use pattern) ───────────────────────┐
HTML: <div class="table-wrap"><table class="compare-table"><thead><tr><th>Feature</th><th>Basic</th><th class="highlight">Pro</th><th>Enterprise</th></tr></thead><tbody><tr><td>Feature name</td><td>✓</td><td class="highlight">✓</td><td>✓</td></tr></tbody></table></div>
CSS:
.table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; border-radius: var(--radius-lg); border: 1px solid rgba(255,255,255,0.06); }
.compare-table { width: 100%; border-collapse: collapse; font-size: 14px; }
.compare-table th, .compare-table td { padding: var(--space-md) var(--space-lg); text-align: center; border-bottom: 1px solid rgba(255,255,255,0.06); }
.compare-table th { font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-muted); background: rgba(255,255,255,0.02); }
.compare-table td:first-child, .compare-table th:first-child { text-align: left; font-weight: 500; }
.compare-table .highlight { background: rgba(ACCENT,0.06); position: relative; }
.compare-table .highlight::before { content: 'Popular'; position: absolute; top: -12px; left: 50%; transform: translateX(-50%); font-size: 10px; background: var(--accent); color: #fff; padding: 2px 10px; border-radius: var(--radius-full); }
.compare-table tbody tr:hover { background: rgba(255,255,255,0.02); }
NOTE: On mobile, the .table-wrap scrolls horizontally. Add a subtle gradient shadow on the right edge to hint scrollability.

┌ TOAST / NOTIFICATION (ready-to-use pattern) ───────────────────┐
HTML: <div id="toast-container"></div> (place at end of body)
CSS:
#toast-container { position: fixed; bottom: var(--space-lg); right: var(--space-lg); z-index: var(--z-toast); display: flex; flex-direction: column; gap: var(--space-sm); pointer-events: none; }
.toast { pointer-events: auto; padding: var(--space-md) var(--space-lg); border-radius: var(--radius-md); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.08); color: var(--text); font-size: 14px; display: flex; align-items: center; gap: var(--space-sm); transform: translateX(120%); opacity: 0; transition: all 0.4s cubic-bezier(0.4,0,0.2,1); }
.toast.show { transform: translateX(0); opacity: 1; }
.toast.success { background: rgba(34,197,94,0.15); border-color: rgba(34,197,94,0.3); }
.toast.error { background: rgba(239,68,68,0.15); border-color: rgba(239,68,68,0.3); }
.toast.info { background: rgba(59,130,246,0.15); border-color: rgba(59,130,246,0.3); }
JS: function showToast(msg, type='info', duration=3000) { const c = document.getElementById('toast-container'); const t = document.createElement('div'); t.className = 'toast ' + type; t.textContent = msg; c.appendChild(t); requestAnimationFrame(() => t.classList.add('show')); setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, duration); }

═══════════════════════════════════════════════════════════════════════════════
§14 — RESPONSIVE DOCTRINE (3 breakpoints, exact values)
═══════════════════════════════════════════════════════════════════════════════

NEVER say "make it responsive." Specify EXACT values at each breakpoint.

BREAKPOINTS:
- Mobile:  < 768px (default/base)
- Tablet:  768px - 1024px (md)
- Desktop: > 1024px (lg)

SCALING RULES:
- Headlines: text-[40px] → md:text-[56px] → lg:text-[72px] (or clamp equivalent)
- Body: text-[14px] → md:text-[16px]
- Padding: px-[24px] → md:px-[40px] → lg:px-[64px]
- Section spacing: py-[48px] → md:py-[80px] → lg:py-[96px]
- Grids: 1 col → md:2 col → lg:3-4 col
- Nav links: hidden mobile (hamburger) → visible tablet+
- Marquee images: h-[280px] → md:h-[500px]
- Cards: full width → fixed width (400-450px)

MOBILE-SPECIFIC:
- Touch targets minimum 44px
- No hover-dependent interactions (use tap)
- Hamburger menu with full-screen overlay
- Marquee speed: faster on mobile (10-15s vs 25-30s desktop)

┌─────────────────────────────────────────────────────────────────┐
│ 14.2 — GRID & LAYOUT SYSTEM (container, gutter, base system)    │
└─────────────────────────────────────────────────────────────────┘

CONTAINER:
- max-width: 1200px (content), 1440px (full bleed sections like hero)
- margin: 0 auto; padding: 0 24px (mobile) / 0 40px (md) / 0 64px (lg)
- CSS: .container { width: 100%; max-width: 1200px; margin: 0 auto; padding: 0 var(--gutter); }

BASE SYSTEM — CSS Grid (preferred) with Flexbox fallback:
- Use CSS Grid for: page layouts, card grids, any 2D arrangement
- Use Flexbox for: navbars, button groups, single-row/column component internals
- NEVER mix Grid and Flex for the same layout task.

GRID TEMPLATE (use these exact patterns):
.grid-cards { display: grid; grid-template-columns: 1fr; gap: var(--gap-md); }
@media (min-width: 768px) { .grid-cards { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 1024px) { .grid-cards { grid-template-columns: repeat(3, 1fr); } }

GUTTER SCALE:
- Cards in grid: gap 24px (mobile) → 32px (md) → 40px (lg)
- Inline elements (buttons, badges): gap 8px-16px
- Stack (vertical flow): gap 16px-24px

┌─────────────────────────────────────────────────────────────────┐
│ 14.3 — DESIGN TOKENS (:root variables for consistency)           │
└─────────────────────────────────────────────────────────────────┘

EVERY project MUST declare these tokens in :root. This is the SINGLE SOURCE OF TRUTH.

/* ═══ SPACING SCALE (8px base) ═══ */
--space-xs: 4px;   --space-sm: 8px;   --space-md: 16px;
--space-lg: 24px;   --space-xl: 32px;  --space-2xl: 48px;
--space-3xl: 64px;  --space-4xl: 96px; --space-5xl: 128px;

/* ═══ SECTION SPACING ═══ */
--section-py: var(--space-2xl);          /* mobile: 48px */
--section-py-md: var(--space-4xl);       /* tablet: 96px */
--section-py-lg: var(--space-5xl);       /* desktop: 128px */

/* ═══ GUTTER ═══ */
--gutter: var(--space-lg);               /* mobile: 24px */
--gutter-md: var(--space-xl);            /* tablet: 32px (adjust in @media) */
--gutter-lg: var(--space-3xl);           /* desktop: 64px (adjust in @media) */

/* ═══ BORDER RADIUS SCALE ═══ */
--radius-sm: 6px;   --radius-md: 12px;  --radius-lg: 20px;
--radius-xl: 32px;  --radius-full: 9999px;

/* ═══ Z-INDEX LAYERS ═══ */
--z-base: 1;        --z-dropdown: 100;   --z-sticky: 200;
--z-overlay: 300;   --z-modal: 400;      --z-toast: 500;
--z-max: 9999;

/* ═══ CONTAINER ═══ */
--container-sm: 640px;  --container-md: 768px;
--container-lg: 1024px; --container-xl: 1200px;
--container-full: 1440px;

USE THESE TOKENS. Do NOT hardcode spacing/radius/z-index values in component CSS.
Exception: one-off values like a specific illustration offset are fine as hardcoded.

`
