'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const i18n: Record<string, Record<string, string>> = {
  en: {
    hero_badge: 'DECENTRALIZED DISTRIBUTION NETWORK',
    hero_title_1: 'Your project reaches',
    hero_title_2: ' who needs it.',
    hero_subtitle: "No SEO. No Meta or Google algorithms. No personal brand. Nexus connects your project directly with users who are looking for it \u2014 even if they don't know you exist.",
    cta_launch: 'Launch your project \u2014 $19.99',
    cta_how: 'How it works',
    cta_title: 'Ready to distribute without intermediaries?',
    cta_desc: 'Join the decentralized distribution network. Your project deserves to reach who needs it \u2014 today.',
    nav_how: 'How it works', nav_pricing: 'Pricing', nav_faq: 'FAQ',
    nav_launch: 'Launch my project', nav_dashboard: 'My Dashboard \u2192',
    social_proof: 'Direct distribution. Results the same day.',
    how_eyebrow: 'The process', how_title: '3 steps. No friction.',
    step1_title: 'Upload your project', step1_desc: 'Name, description, URL and category. The Classifier Agent analyzes it automatically and prepares it for distribution in minutes.',
    step2_title: 'Pay the launch', step2_desc: '$19.99 one-time. No subscriptions. No sales commissions. The Guardian Agent reviews your project and approves it automatically.',
    step3_title: 'Reach your audience', step3_desc: 'The Nexus network distributes your project to relevant users in real time. See impressions and click metrics in your dashboard.',
    stat1: 'Cost for consumers', stat2: 'Per unique launch', stat3: 'Sales commission', stat4: 'Anonymous for consumers',
    pricing_eyebrow: 'Pricing', pricing_title: 'Simple. No surprises.',
    plan_consumer: 'Consumer', plan_consumer_period: 'Free forever',
    plan_creator: 'Creator', plan_creator_period: 'One-time payment per launch',
    badge_popular: 'Most popular',
    feat_c1: 'Personalized recommendations', feat_c2: 'Nexus internal search', feat_c3: '100% anonymous \u2014 no account', feat_c4: 'No invasive advertising', feat_c5: 'Chrome / Firefox extension',
    feat_p1: 'Immediate distribution', feat_p2: 'Guardian review in minutes', feat_p3: 'Real-time metrics', feat_p4: 'No sales commission', feat_p5: 'Reach the same day', feat_p6: 'Analytics dashboard',
    btn_download: 'Download extension', btn_launch: 'Launch my project \u2192',
    faq_eyebrow: 'FAQ', faq_title: 'Everything you need to know',
    faq1_q: 'How does my project reach users?', faq1_a: "The Nexus extension analyzes each user's anonymous behavior and shows relevant projects as discreet notifications. No spam, no interruptions.",
    faq2_q: 'What happens if my project is rejected?', faq2_a: 'The Guardian Agent explains exactly what to fix by email. You can edit your project and relaunch it by paying again.',
    faq3_q: 'Do consumers need the extension?', faq3_a: 'No. The embeddable widget allows any visitor to your site to discover other Nexus projects \u2014 without an extension.',
    faq4_q: 'Is my data safe?', faq4_a: 'Consumers are 100% anonymous \u2014 no account, no email, no tracking. Their interest profile lives only on their device.',
    faq5_q: 'How long does a launch last?', faq5_a: 'No time limit. Your project is distributed until the reach is organically exhausted. You can relaunch at any time for $19.99.',
    footer_copy: '\u00a9 2025 Nexus. Part of the Octopus Skills ecosystem.',
    footer_privacy: 'Privacy', footer_terms: 'Terms', footer_contact: 'Contact',
    btn_start: 'Get started \u2192'
  },
  es: {
    hero_badge: 'RED DE DISTRIBUCI\u00d3N DESCENTRALIZADA',
    hero_title_1: 'Tu proyecto llega a',
    hero_title_2: ' quien lo necesita.',
    hero_subtitle: 'Sin SEO. Sin algoritmos de Meta o Google. Sin marca personal. Nexus conecta tu proyecto directamente con usuarios que lo est\u00e1n buscando \u2014 aunque no sepan que existes.',
    cta_launch: 'Lanza tu proyecto \u2014 $19.99',
    cta_how: 'Ver c\u00f3mo funciona',
    cta_title: '\u00bfListo para distribuir sin intermediarios?',
    cta_desc: '\u00danete a la red de distribuci\u00f3n descentralizada. Tu proyecto merece llegar a quien lo necesita \u2014 hoy mismo.',
    nav_how: 'C\u00f3mo funciona', nav_pricing: 'Precio', nav_faq: 'FAQ',
    nav_launch: 'Lanzar mi proyecto', nav_dashboard: 'Mi Dashboard \u2192',
    social_proof: 'Distribuci\u00f3n directa. Resultados el mismo d\u00eda.',
    how_eyebrow: 'El proceso', how_title: '3 pasos. Sin fricci\u00f3n.',
    step1_title: 'Sube tu proyecto', step1_desc: 'Nombre, descripci\u00f3n, URL y categor\u00eda. El Agente Clasificador lo analiza autom\u00e1ticamente y lo prepara para distribuci\u00f3n en minutos.',
    step2_title: 'Paga el lanzamiento', step2_desc: '$19.99 \u00fanico. Sin suscripciones. Sin comisiones por venta. El Agente Guardi\u00e1n revisa tu proyecto y lo aprueba autom\u00e1ticamente.',
    step3_title: 'Llega a tu audiencia', step3_desc: 'La red Nexus distribuye tu proyecto a usuarios relevantes en tiempo real. Ves las m\u00e9tricas de impresiones y clics en tu dashboard.',
    stat1: 'Costo para consumidores', stat2: 'Por lanzamiento \u00fanico', stat3: 'Comisi\u00f3n por ventas', stat4: 'An\u00f3nimo para consumidores',
    pricing_eyebrow: 'Precio', pricing_title: 'Simple. Sin sorpresas.',
    plan_consumer: 'Consumidor', plan_consumer_period: 'Para siempre gratis',
    plan_creator: 'Creador', plan_creator_period: 'Pago \u00fanico por lanzamiento',
    badge_popular: 'M\u00e1s popular',
    feat_c1: 'Recomendaciones personalizadas', feat_c2: 'Buscador interno Nexus', feat_c3: '100% an\u00f3nimo \u2014 sin cuenta', feat_c4: 'Sin publicidad invasiva', feat_c5: 'Extensi\u00f3n Chrome / Firefox',
    feat_p1: 'Distribuci\u00f3n inmediata', feat_p2: 'Revisi\u00f3n del Guardi\u00e1n en minutos', feat_p3: 'M\u00e9tricas en tiempo real', feat_p4: 'Sin comisi\u00f3n por ventas', feat_p5: 'Llega el mismo d\u00eda', feat_p6: 'Dashboard de analytics',
    btn_download: 'Descargar extensi\u00f3n', btn_launch: 'Lanzar mi proyecto \u2192',
    faq_eyebrow: 'Preguntas frecuentes', faq_title: 'Todo lo que necesitas saber',
    faq1_q: '\u00bfC\u00f3mo llega mi proyecto a los usuarios?', faq1_a: 'La extensi\u00f3n Nexus analiza el comportamiento an\u00f3nimo de cada usuario y muestra proyectos relevantes como notificaciones discretas. Sin spam, sin interrupciones.',
    faq2_q: '\u00bfQu\u00e9 pasa si mi proyecto es rechazado?', faq2_a: 'El Agente Guardi\u00e1n te explica exactamente qu\u00e9 corregir por email. Puedes editar tu proyecto y relanzarlo pagando de nuevo.',
    faq3_q: '\u00bfLos consumidores necesitan la extensi\u00f3n?', faq3_a: 'No. El widget embebible permite que cualquier visitante de tu sitio descubra otros proyectos Nexus \u2014 sin extensi\u00f3n.',
    faq4_q: '\u00bfMis datos est\u00e1n seguros?', faq4_a: 'Los consumidores son 100% an\u00f3nimos \u2014 sin cuenta, sin email, sin rastreo. Su perfil de intereses vive solo en su dispositivo.',
    faq5_q: '\u00bfCu\u00e1nto dura un lanzamiento?', faq5_a: 'No hay l\u00edmite de tiempo. Tu proyecto se distribuye hasta que el alcance se agota org\u00e1nicamente. Puedes relanzar en cualquier momento por $19.99.',
    footer_copy: '\u00a9 2025 Nexus. Parte del ecosistema Octopus Skills.',
    footer_privacy: 'Privacidad', footer_terms: 'T\u00e9rminos', footer_contact: 'Contacto',
    btn_start: 'Empezar \u2192'
  }
}

function detectLang(): string {
  if (typeof window === 'undefined') return 'en'
  try {
    const stored = localStorage.getItem('nexus_lang')
    if (stored === 'en' || stored === 'es') return stored
    const param = new URLSearchParams(window.location.search).get('lang')
    if (param === 'en' || param === 'es') return param
    return (navigator.language || '').toLowerCase().startsWith('es') ? 'es' : 'en'
  } catch { return 'en' }
}

export function NexusLandingClient({ isLoggedIn }: { isLoggedIn: boolean }) {
  const [lang, setLangState] = useState('en')
  const t = (key: string) => i18n[lang]?.[key] || i18n.en[key] || key

  useEffect(() => {
    setLangState(detectLang())
  }, [])

  function setLang(l: string) {
    setLangState(l)
    try { localStorage.setItem('nexus_lang', l) } catch {}
  }

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target) }
      })
    }, { threshold: 0.12 })
    document.querySelectorAll('.nexus-reveal').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [lang])

  return (
    <main className="nexus-landing">
      {/* NAV */}
      <nav className="nexus-nav">
        <div className="nexus-nav-inner">
          <span className="nexus-logo">NEXUS</span>
          <div className="nexus-nav-links">
            <a href="#how">{t('nav_how')}</a>
            <a href="#pricing">{t('nav_pricing')}</a>
            <a href="#faq">{t('nav_faq')}</a>
          </div>
          <div className="nexus-nav-right">
            <div className="nexus-lang-toggle">
              <button className={`nexus-lang-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => setLang('en')}>EN</button>
              <button className={`nexus-lang-btn ${lang === 'es' ? 'active' : ''}`} onClick={() => setLang('es')}>ES</button>
            </div>
            {isLoggedIn ? (
              <Link href="/nexus/dashboard" className="nexus-btn-primary">{t('nav_dashboard')}</Link>
            ) : (
              <Link href="/login?callbackUrl=/nexus/dashboard" className="nexus-btn-primary">{t('nav_launch')}</Link>
            )}
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="nexus-hero" id="hero">
        <div className="nexus-hero-bg">
          <div className="nexus-orb nexus-orb-1" />
          <div className="nexus-orb nexus-orb-2" />
          <div className="nexus-orb nexus-orb-3" />
          <div className="nexus-grid-overlay" />
        </div>
        <div className="nexus-hero-content">
          <span className="nexus-eyebrow">{t('hero_badge')}</span>
          <h1 className="nexus-hero-title">
            {t('hero_title_1')}<span className="nexus-gradient-text">{t('hero_title_2')}</span>
          </h1>
          <p className="nexus-hero-sub">{t('hero_subtitle')}</p>
          <div className="nexus-hero-ctas">
            {isLoggedIn ? (
              <Link href="/nexus/dashboard" className="nexus-btn-primary nexus-btn-lg">{t('cta_launch')}</Link>
            ) : (
              <Link href="/login?callbackUrl=/nexus/dashboard" className="nexus-btn-primary nexus-btn-lg">{t('cta_launch')}</Link>
            )}
            <a href="#how" className="nexus-btn-ghost nexus-btn-lg">{t('cta_how')}</a>
          </div>
          <div className="nexus-social-proof">
            <span className="nexus-stars">★★★★★</span>
            <span>{t('social_proof')}</span>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="nexus-section" id="how">
        <div className="nexus-container">
          <span className="nexus-eyebrow">{t('how_eyebrow')}</span>
          <h2 className="nexus-section-title">{t('how_title')}</h2>
          <div className="nexus-steps">
            <div className="nexus-step nexus-reveal"><div className="nexus-step-num">01</div><h3>{t('step1_title')}</h3><p>{t('step1_desc')}</p></div>
            <div className="nexus-step-divider" />
            <div className="nexus-step nexus-reveal"><div className="nexus-step-num">02</div><h3>{t('step2_title')}</h3><p>{t('step2_desc')}</p></div>
            <div className="nexus-step-divider" />
            <div className="nexus-step nexus-reveal"><div className="nexus-step-num">03</div><h3>{t('step3_title')}</h3><p>{t('step3_desc')}</p></div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="nexus-section nexus-section-alt" id="stats">
        <div className="nexus-container">
          <div className="nexus-stats-grid">
            <div className="nexus-stat-card nexus-reveal"><span className="nexus-stat-value nexus-stat-value-gradient">$0</span><span className="nexus-stat-label">{t('stat1')}</span></div>
            <div className="nexus-stat-card nexus-reveal"><span className="nexus-stat-value nexus-stat-value-gradient">$19.99</span><span className="nexus-stat-label">{t('stat2')}</span></div>
            <div className="nexus-stat-card nexus-reveal"><span className="nexus-stat-value nexus-stat-value-gradient">0%</span><span className="nexus-stat-label">{t('stat3')}</span></div>
            <div className="nexus-stat-card nexus-reveal"><span className="nexus-stat-value nexus-stat-value-gradient">100%</span><span className="nexus-stat-label">{t('stat4')}</span></div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="nexus-section" id="pricing">
        <div className="nexus-container">
          <span className="nexus-eyebrow">{t('pricing_eyebrow')}</span>
          <h2 className="nexus-section-title">{t('pricing_title')}</h2>
          <div className="nexus-pricing-grid">
            <div className="nexus-pricing-card nexus-reveal">
              <div className="nexus-pricing-badge">{t('plan_consumer')}</div>
              <div className="nexus-pricing-price">$0</div>
              <p className="nexus-pricing-desc">{t('plan_consumer_period')}</p>
              <ul className="nexus-pricing-features">
                <li>{t('feat_c1')}</li><li>{t('feat_c2')}</li><li>{t('feat_c3')}</li><li>{t('feat_c4')}</li><li>{t('feat_c5')}</li>
              </ul>
              <button className="nexus-btn-ghost nexus-btn-full">{t('btn_download')}</button>
            </div>
            <div className="nexus-pricing-card nexus-pricing-featured nexus-reveal">
              <div className="nexus-featured-badge">{t('badge_popular')}</div>
              <div className="nexus-pricing-badge nexus-badge-accent">{t('plan_creator')}</div>
              <div className="nexus-pricing-price">$19.99</div>
              <p className="nexus-pricing-desc">{t('plan_creator_period')}</p>
              <ul className="nexus-pricing-features">
                <li>{t('feat_p1')}</li><li>{t('feat_p2')}</li><li>{t('feat_p3')}</li><li>{t('feat_p4')}</li><li>{t('feat_p5')}</li><li>{t('feat_p6')}</li>
              </ul>
              {isLoggedIn ? (
                <Link href="/nexus/dashboard/projects/new" className="nexus-btn-primary nexus-btn-full">{t('btn_launch')}</Link>
              ) : (
                <Link href="/login?callbackUrl=/nexus/dashboard" className="nexus-btn-primary nexus-btn-full">{t('btn_start')}</Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="nexus-section nexus-section-alt" id="faq">
        <div className="nexus-container nexus-container-sm">
          <span className="nexus-eyebrow">{t('faq_eyebrow')}</span>
          <h2 className="nexus-section-title">{t('faq_title')}</h2>
          <div className="nexus-faq">
            {[1,2,3,4,5].map(n => (
              <details key={n} className="nexus-faq-item" {...(n === 1 ? { open: true } : {})}>
                <summary className="nexus-faq-q">{t(`faq${n}_q`)}</summary>
                <p className="nexus-faq-a">{t(`faq${n}_a`)}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="nexus-section">
        <div className="nexus-container">
          <div className="nexus-cta-box nexus-reveal">
            <h2>{t('cta_title')}</h2>
            <p>{t('cta_desc')}</p>
            <div className="nexus-cta-buttons">
              {isLoggedIn ? (
                <Link href="/nexus/dashboard" className="nexus-btn-primary nexus-btn-lg">{t('cta_launch')}</Link>
              ) : (
                <Link href="/login?callbackUrl=/nexus/dashboard" className="nexus-btn-primary nexus-btn-lg">{t('cta_launch')}</Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="nexus-footer">
        <div className="nexus-footer-inner">
          <span className="nexus-logo">NEXUS</span>
          <p className="nexus-footer-copy">{t('footer_copy')}</p>
          <div className="nexus-footer-links">
            <Link href="/legal">{t('footer_privacy')}</Link>
            <Link href="/legal#terms-of-use">{t('footer_terms')}</Link>
            <a href="mailto:contact@octopuskills.com">{t('footer_contact')}</a>
          </div>
        </div>
      </footer>
    </main>
  )
}
