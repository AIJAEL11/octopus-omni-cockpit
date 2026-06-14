// LIBRERÍA DE COMPONENTES CINEMATOGRÁFICOS
// Sistema de bloques premium para generación de proyectos

export interface CinematicSection {
  id: string
  type: SectionType
  name: string
  description: string
  props: Record<string, any>
  code: string
}

export type SectionType = 
  | 'hero-cinematic'
  | 'hero-split'
  | 'hero-video'
  | 'features-grid'
  | 'features-bento'
  | 'features-alternating'
  | 'pricing-cards'
  | 'testimonials-carousel'
  | 'testimonials-grid'
  | 'cta-centered'
  | 'cta-split'
  | 'faq-accordion'
  | 'team-grid'
  | 'stats-counter'
  | 'logo-cloud'
  | 'footer-premium'
  | 'navbar-floating'

export const CINEMATIC_ANIMATIONS = {
  fadeUp: {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
  },
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: 0.8 }
  },
  scaleIn: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    transition: { duration: 0.5, ease: 'easeOut' }
  },
  slideInLeft: {
    initial: { opacity: 0, x: -50 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
  },
  slideInRight: {
    initial: { opacity: 0, x: 50 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] }
  },
  staggerChildren: {
    animate: { transition: { staggerChildren: 0.1 } }
  },
  magneticHover: {
    whileHover: { scale: 1.02 },
    whileTap: { scale: 0.98 },
    transition: { type: 'spring', stiffness: 400, damping: 17 }
  },
  glowPulse: {
    animate: { 
      boxShadow: ['0 0 20px rgba(204, 88, 51, 0.3)', '0 0 40px rgba(204, 88, 51, 0.5)', '0 0 20px rgba(204, 88, 51, 0.3)']
    },
    transition: { duration: 2, repeat: Infinity }
  }
}

export const SECTION_TEMPLATES: Record<SectionType, CinematicSection> = {
  'hero-cinematic': {
    id: 'hero-cinematic',
    type: 'hero-cinematic',
    name: 'Hero Cinematográfico',
    description: 'Hero de pantalla completa con gradiente, tipografía mixta y animaciones escalonadas',
    props: {
      title: 'Tu Título',
      titleAccent: 'Destacado',
      subtitle: 'Descripción convincente de tu producto o servicio',
      ctaPrimary: 'Comenzar Ahora',
      ctaSecondary: 'Ver Demo',
      backgroundImage: 'https://images.unsplash.com/photo-1470115636492-6d2b56f9146d'
    },
    code: `
<section className="relative min-h-screen flex items-end overflow-hidden" style={{ background: 'linear-gradient(135deg, #2E4036 0%, #1A1A1A 100%)' }}>
  {/* Textura de ruido */}
  <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,...")' }} />
  
  {/* Imagen de fondo con overlay */}
  <div className="absolute inset-0">
    <Image src="{{backgroundImage}}" alt="" fill className="object-cover opacity-30" />
    <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A1A] via-[#1A1A1A]/50 to-transparent" />
  </div>

  <div className="relative z-10 p-12 pb-20 max-w-4xl">
    <motion.h1 
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className="text-6xl md:text-7xl font-bold text-white mb-6 leading-tight"
    >
      <span className="font-sans">{{title}}</span>
      <span className="block font-serif italic text-7xl md:text-8xl text-[#CC5833]">{{titleAccent}}</span>
    </motion.h1>
    
    <motion.p 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.6 }}
      className="text-xl text-white/70 mb-10 max-w-2xl"
    >
      {{subtitle}}
    </motion.p>
    
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.6 }}
      className="flex gap-4"
    >
      <button className="px-8 py-4 rounded-2xl font-semibold text-white bg-[#CC5833] hover:scale-105 transition-all">
        {{ctaPrimary}}
      </button>
      <button className="px-8 py-4 rounded-2xl font-semibold text-white/80 border border-white/20 hover:bg-white/10 transition-all">
        {{ctaSecondary}}
      </button>
    </motion.div>
  </div>
</section>`
  },

  'hero-split': {
    id: 'hero-split',
    type: 'hero-split',
    name: 'Hero Dividido',
    description: 'Hero con contenido a la izquierda e imagen/mockup a la derecha',
    props: {
      title: 'Título Principal',
      subtitle: 'Descripción del producto',
      ctaPrimary: 'Empezar Gratis',
      image: 'https://images.unsplash.com/photo-1551434678-e076c223a692'
    },
    code: `
<section className="min-h-screen flex items-center" style={{ backgroundColor: '#F2F0E9' }}>
  <div className="max-w-7xl mx-auto px-8 grid grid-cols-2 gap-16 items-center">
    <motion.div initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.8 }}>
      <span className="text-[#CC5833] font-mono text-sm uppercase tracking-wider">Nuevo</span>
      <h1 className="text-5xl md:text-6xl font-bold text-[#1A1A1A] mt-4 mb-6 leading-tight">
        {{title}}
      </h1>
      <p className="text-xl text-gray-600 mb-8">{{subtitle}}</p>
      <button className="px-8 py-4 rounded-2xl font-semibold text-white bg-[#2E4036] hover:scale-105 transition-all">
        {{ctaPrimary}}
      </button>
    </motion.div>
    <motion.div 
      initial={{ opacity: 0, x: 50 }} 
      animate={{ opacity: 1, x: 0 }} 
      transition={{ duration: 0.8, delay: 0.2 }}
      className="relative"
    >
      <div className="aspect-square rounded-3xl overflow-hidden shadow-2xl">
        <Image src="{{image}}" alt="" fill className="object-cover" />
      </div>
    </motion.div>
  </div>
</section>`
  },

  'hero-video': {
    id: 'hero-video',
    type: 'hero-video',
    name: 'Hero con Video',
    description: 'Hero con video de fondo en loop',
    props: {
      title: 'Experiencia Inmersiva',
      subtitle: 'Video de fondo cinematográfico',
      videoUrl: '/video-bg.mp4'
    },
    code: `
<section className="relative min-h-screen flex items-center justify-center overflow-hidden">
  <video autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover">
    <source src="{{videoUrl}}" type="video/mp4" />
  </video>
  <div className="absolute inset-0 bg-black/50" />
  <div className="relative z-10 text-center max-w-4xl px-8">
    <motion.h1 
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-6xl md:text-7xl font-bold text-white mb-6"
    >
      {{title}}
    </motion.h1>
    <motion.p 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.3 }}
      className="text-xl text-white/80"
    >
      {{subtitle}}
    </motion.p>
  </div>
</section>`
  },

  'features-grid': {
    id: 'features-grid',
    type: 'features-grid',
    name: 'Features Grid',
    description: 'Grid de características con iconos y micro-interacciones',
    props: {
      title: 'Características',
      subtitle: 'Todo lo que necesitas',
      features: [
        { icon: 'Zap', title: 'Ultra Rápido', description: 'Rendimiento optimizado al máximo' },
        { icon: 'Shield', title: 'Seguro', description: 'Encriptación de nivel empresarial' },
        { icon: 'Sparkles', title: 'IA Integrada', description: 'Automatización inteligente' }
      ]
    },
    code: `
<section className="py-24 px-8" style={{ backgroundColor: '#F2F0E9' }}>
  <div className="max-w-6xl mx-auto">
    <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} className="text-center mb-16">
      <h2 className="text-4xl font-bold text-[#2E4036] mb-4">{{title}}</h2>
      <p className="text-gray-600 text-lg">{{subtitle}}</p>
    </motion.div>
    
    <div className="grid grid-cols-3 gap-8">
      {features.map((feature, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          whileHover={{ y: -5 }}
          className="group relative bg-white p-8 rounded-3xl shadow-sm hover:shadow-xl transition-all duration-500"
        >
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] uppercase tracking-wider text-gray-400 font-mono">Activo</span>
          </div>
          
          <div className="w-14 h-14 rounded-2xl bg-[#CC5833]/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
            <Icon className="w-7 h-7 text-[#CC5833]" />
          </div>
          
          <h3 className="font-bold text-lg text-[#2E4036] mb-3">{feature.title}</h3>
          <p className="text-sm text-gray-500">{feature.description}</p>
        </motion.div>
      ))}
    </div>
  </div>
</section>`
  },

  'features-bento': {
    id: 'features-bento',
    type: 'features-bento',
    name: 'Features Bento Grid',
    description: 'Layout estilo Bento con tarjetas de diferentes tamaños',
    props: {
      features: [
        { size: 'large', title: 'Feature Principal', description: 'Descripción extensa' },
        { size: 'small', title: 'Feature 2', description: 'Breve' },
        { size: 'small', title: 'Feature 3', description: 'Breve' },
        { size: 'medium', title: 'Feature 4', description: 'Media' }
      ]
    },
    code: `
<section className="py-24 px-8" style={{ backgroundColor: '#1A1A1A' }}>
  <div className="max-w-6xl mx-auto">
    <div className="grid grid-cols-4 grid-rows-2 gap-4 h-[600px]">
      <motion.div 
        className="col-span-2 row-span-2 bg-gradient-to-br from-[#2E4036] to-[#1A1A1A] rounded-3xl p-8 flex flex-col justify-end"
        whileHover={{ scale: 1.02 }}
      >
        <h3 className="text-3xl font-bold text-white mb-2">Feature Principal</h3>
        <p className="text-white/60">Descripción detallada de la característica más importante</p>
      </motion.div>
      <motion.div className="bg-[#CC5833] rounded-3xl p-6" whileHover={{ scale: 1.02 }}>
        <h4 className="text-xl font-bold text-white">Rápido</h4>
      </motion.div>
      <motion.div className="bg-white rounded-3xl p-6" whileHover={{ scale: 1.02 }}>
        <h4 className="text-xl font-bold text-[#2E4036]">Seguro</h4>
      </motion.div>
      <motion.div className="col-span-2 bg-[#F2F0E9] rounded-3xl p-6" whileHover={{ scale: 1.02 }}>
        <h4 className="text-xl font-bold text-[#2E4036]">Integrado con todo</h4>
      </motion.div>
    </div>
  </div>
</section>`
  },

  'features-alternating': {
    id: 'features-alternating',
    type: 'features-alternating',
    name: 'Features Alternados',
    description: 'Secciones de feature con imagen alternando izquierda/derecha',
    props: {
      features: [
        { title: 'Feature 1', description: 'Descripción', image: 'url', imagePosition: 'right' },
        { title: 'Feature 2', description: 'Descripción', image: 'url', imagePosition: 'left' }
      ]
    },
    code: `
<section className="py-24" style={{ backgroundColor: '#F2F0E9' }}>
  {features.map((feature, i) => (
    <div key={i} className={\`max-w-6xl mx-auto px-8 py-16 grid grid-cols-2 gap-16 items-center \${i % 2 === 1 ? 'direction-rtl' : ''}\`}>
      <motion.div initial={{ opacity: 0, x: i % 2 === 0 ? -50 : 50 }} whileInView={{ opacity: 1, x: 0 }}>
        <span className="text-[#CC5833] font-mono text-sm">0{i + 1}</span>
        <h3 className="text-4xl font-bold text-[#2E4036] mt-2 mb-4">{feature.title}</h3>
        <p className="text-gray-600 text-lg">{feature.description}</p>
      </motion.div>
      <motion.div 
        initial={{ opacity: 0, x: i % 2 === 0 ? 50 : -50 }} 
        whileInView={{ opacity: 1, x: 0 }}
        className="aspect-video rounded-3xl overflow-hidden shadow-xl"
      >
        <Image src={feature.image} alt="" fill className="object-cover" />
      </motion.div>
    </div>
  ))}
</section>`
  },

  'pricing-cards': {
    id: 'pricing-cards',
    type: 'pricing-cards',
    name: 'Pricing Cards',
    description: 'Tarjetas de precios con plan destacado',
    props: {
      title: 'Planes',
      plans: [
        { name: 'Starter', price: '$9', period: '/mes', features: ['Feature 1', 'Feature 2'], cta: 'Comenzar' },
        { name: 'Pro', price: '$29', period: '/mes', features: ['Todo de Starter', 'Feature 3', 'Feature 4'], cta: 'Elegir Pro', featured: true },
        { name: 'Enterprise', price: 'Contactar', period: '', features: ['Todo de Pro', 'Soporte dedicado'], cta: 'Contactar' }
      ]
    },
    code: `
<section className="py-24 px-8" style={{ backgroundColor: '#F2F0E9' }}>
  <div className="max-w-5xl mx-auto">
    <motion.h2 
      initial={{ opacity: 0, y: 20 }} 
      whileInView={{ opacity: 1, y: 0 }}
      className="text-4xl font-bold text-center text-[#2E4036] mb-16"
    >
      {{title}}
    </motion.h2>
    
    <div className="grid grid-cols-3 gap-8">
      {plans.map((plan, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className={\`p-8 rounded-3xl \${plan.featured ? 'bg-[#2E4036] text-white scale-105 shadow-2xl' : 'bg-white'}\`}
        >
          <h3 className={\`text-xl font-bold mb-2 \${plan.featured ? 'text-white' : 'text-[#2E4036]'}\`}>
            {plan.name}
          </h3>
          <div className="flex items-baseline gap-1 mb-6">
            <span className="text-4xl font-bold">{plan.price}</span>
            <span className="text-sm opacity-60">{plan.period}</span>
          </div>
          <ul className="space-y-3 mb-8">
            {plan.features.map((f, j) => (
              <li key={j} className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-[#CC5833]" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <button className={\`w-full py-3 rounded-xl font-semibold transition-all hover:scale-105 \${
            plan.featured ? 'bg-[#CC5833] text-white' : 'bg-[#2E4036] text-white'
          }\`}>
            {plan.cta}
          </button>
        </motion.div>
      ))}
    </div>
  </div>
</section>`
  },

  'testimonials-carousel': {
    id: 'testimonials-carousel',
    type: 'testimonials-carousel',
    name: 'Testimonios Carrusel',
    description: 'Carrusel de testimonios con autoplay',
    props: {
      testimonials: [
        { quote: 'Increíble producto', author: 'Juan Pérez', role: 'CEO, Empresa', avatar: 'url' }
      ]
    },
    code: `
<section className="py-24 overflow-hidden" style={{ backgroundColor: '#1A1A1A' }}>
  <motion.div 
    className="flex gap-8"
    animate={{ x: [0, -1000] }}
    transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
  >
    {[...testimonials, ...testimonials].map((t, i) => (
      <div key={i} className="min-w-[400px] bg-white/5 backdrop-blur p-8 rounded-3xl">
        <p className="text-white text-lg mb-6">"{t.quote}"</p>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-[#2E4036]" />
          <div>
            <p className="text-white font-semibold">{t.author}</p>
            <p className="text-white/60 text-sm">{t.role}</p>
          </div>
        </div>
      </div>
    ))}
  </motion.div>
</section>`
  },

  'testimonials-grid': {
    id: 'testimonials-grid',
    type: 'testimonials-grid',
    name: 'Testimonios Grid',
    description: 'Grid de testimonios estilo masonry',
    props: {
      title: 'Lo que dicen nuestros clientes',
      testimonials: []
    },
    code: `
<section className="py-24 px-8" style={{ backgroundColor: '#F2F0E9' }}>
  <h2 className="text-4xl font-bold text-center text-[#2E4036] mb-16">{{title}}</h2>
  <div className="columns-3 gap-8 max-w-6xl mx-auto">
    {testimonials.map((t, i) => (
      <motion.div
        key={i}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        className="break-inside-avoid mb-8 bg-white p-6 rounded-2xl shadow-sm"
      >
        <p className="text-gray-700 mb-4">"{t.quote}"</p>
        <p className="font-semibold text-[#2E4036]">{t.author}</p>
        <p className="text-sm text-gray-500">{t.role}</p>
      </motion.div>
    ))}
  </div>
</section>`
  },

  'cta-centered': {
    id: 'cta-centered',
    type: 'cta-centered',
    name: 'CTA Centrado',
    description: 'Call to action centrado con fondo de alto contraste',
    props: {
      preTitle: 'Lo normal es conformarse con lo básico',
      title: 'Nosotros construimos',
      titleAccent: 'excelencia',
      cta: 'Comenzar Ahora'
    },
    code: `
<section className="py-24 px-8 relative overflow-hidden" style={{ backgroundColor: '#1A1A1A' }}>
  <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '32px 32px' }} />
  
  <div className="relative z-10 max-w-4xl mx-auto text-center">
    <motion.p 
      initial={{ opacity: 0 }} 
      whileInView={{ opacity: 1 }}
      className="text-white/40 text-xl mb-4 line-through"
    >
      {{preTitle}}
    </motion.p>
    <motion.h2 
      initial={{ opacity: 0, y: 20 }} 
      whileInView={{ opacity: 1, y: 0 }}
      className="text-5xl font-bold text-white mb-8"
    >
      {{title}} <span className="font-serif italic text-[#CC5833]">{{titleAccent}}</span>
    </motion.h2>
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.05 }}
      className="px-10 py-4 bg-[#CC5833] text-white font-semibold rounded-2xl"
    >
      {{cta}}
    </motion.button>
  </div>
</section>`
  },

  'cta-split': {
    id: 'cta-split',
    type: 'cta-split',
    name: 'CTA Dividido',
    description: 'CTA con imagen lateral',
    props: {
      title: '¿Listo para empezar?',
      description: 'Únete a miles de usuarios',
      cta: 'Crear cuenta gratis',
      image: 'url'
    },
    code: `
<section className="py-24 px-8" style={{ backgroundColor: '#2E4036' }}>
  <div className="max-w-6xl mx-auto grid grid-cols-2 gap-16 items-center">
    <div>
      <h2 className="text-4xl font-bold text-white mb-4">{{title}}</h2>
      <p className="text-white/70 text-lg mb-8">{{description}}</p>
      <button className="px-8 py-4 bg-[#CC5833] text-white font-semibold rounded-2xl hover:scale-105 transition-all">
        {{cta}}
      </button>
    </div>
    <div className="aspect-video rounded-3xl overflow-hidden">
      <Image src="{{image}}" alt="" fill className="object-cover" />
    </div>
  </div>
</section>`
  },

  'faq-accordion': {
    id: 'faq-accordion',
    type: 'faq-accordion',
    name: 'FAQ Acordeón',
    description: 'Preguntas frecuentes con animación de acordeón',
    props: {
      title: 'Preguntas Frecuentes',
      faqs: [
        { question: '¿Cómo funciona?', answer: 'Respuesta detallada...' }
      ]
    },
    code: `
<section className="py-24 px-8" style={{ backgroundColor: '#F2F0E9' }}>
  <div className="max-w-3xl mx-auto">
    <h2 className="text-4xl font-bold text-center text-[#2E4036] mb-16">{{title}}</h2>
    <div className="space-y-4">
      {faqs.map((faq, i) => (
        <motion.div key={i} className="bg-white rounded-2xl overflow-hidden">
          <button className="w-full p-6 text-left flex justify-between items-center">
            <span className="font-semibold text-[#2E4036]">{faq.question}</span>
            <ChevronDown className="text-[#CC5833]" />
          </button>
          <AnimatePresence>
            {openIndex === i && (
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: 'auto' }}
                exit={{ height: 0 }}
                className="px-6 pb-6 text-gray-600"
              >
                {faq.answer}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      ))}
    </div>
  </div>
</section>`
  },

  'team-grid': {
    id: 'team-grid',
    type: 'team-grid',
    name: 'Equipo Grid',
    description: 'Grid de miembros del equipo',
    props: {
      title: 'Nuestro Equipo',
      members: [{ name: 'Nombre', role: 'Cargo', image: 'url' }]
    },
    code: `
<section className="py-24 px-8" style={{ backgroundColor: '#F2F0E9' }}>
  <h2 className="text-4xl font-bold text-center text-[#2E4036] mb-16">{{title}}</h2>
  <div className="grid grid-cols-4 gap-8 max-w-6xl mx-auto">
    {members.map((m, i) => (
      <motion.div
        key={i}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.1 }}
        className="text-center"
      >
        <div className="aspect-square rounded-3xl overflow-hidden mb-4 bg-gray-200">
          <Image src={m.image} alt={m.name} fill className="object-cover" />
        </div>
        <h4 className="font-bold text-[#2E4036]">{m.name}</h4>
        <p className="text-sm text-gray-500">{m.role}</p>
      </motion.div>
    ))}
  </div>
</section>`
  },

  'stats-counter': {
    id: 'stats-counter',
    type: 'stats-counter',
    name: 'Estadísticas Animadas',
    description: 'Contadores animados de estadísticas',
    props: {
      stats: [
        { value: '10K+', label: 'Usuarios activos' },
        { value: '99%', label: 'Satisfacción' },
        { value: '24/7', label: 'Soporte' }
      ]
    },
    code: `
<section className="py-16 px-8" style={{ backgroundColor: '#2E4036' }}>
  <div className="max-w-5xl mx-auto grid grid-cols-3 gap-8">
    {stats.map((stat, i) => (
      <motion.div
        key={i}
        initial={{ opacity: 0, scale: 0.5 }}
        whileInView={{ opacity: 1, scale: 1 }}
        transition={{ delay: i * 0.1, type: 'spring' }}
        className="text-center"
      >
        <span className="text-5xl font-bold text-white">{stat.value}</span>
        <p className="text-white/60 mt-2">{stat.label}</p>
      </motion.div>
    ))}
  </div>
</section>`
  },

  'logo-cloud': {
    id: 'logo-cloud',
    type: 'logo-cloud',
    name: 'Logo Cloud',
    description: 'Carrusel de logos de clientes/partners',
    props: {
      title: 'Confían en nosotros',
      logos: []
    },
    code: `
<section className="py-16 px-8" style={{ backgroundColor: '#F2F0E9' }}>
  <p className="text-center text-gray-500 mb-8">{{title}}</p>
  <div className="flex justify-center items-center gap-12 opacity-50 grayscale hover:grayscale-0 hover:opacity-100 transition-all">
    {logos.map((logo, i) => (
      <Image key={i} src={logo} alt="" width={120} height={40} className="object-contain" />
    ))}
  </div>
</section>`
  },

  'footer-premium': {
    id: 'footer-premium',
    type: 'footer-premium',
    name: 'Footer Premium',
    description: 'Footer con bordes redondeados y estado del sistema',
    props: {
      brandName: 'Octopus',
      links: [{ label: 'Inicio', href: '/' }],
      systemStatus: 'Activo'
    },
    code: `
<footer className="py-12 px-8 rounded-t-[3rem]" style={{ backgroundColor: '#2E4036' }}>
  <div className="max-w-6xl mx-auto">
    <div className="flex items-center justify-between mb-12">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
          <span className="text-xl">🐙</span>
        </div>
        <span className="text-white font-bold text-xl">{{brandName}}</span>
      </div>
      
      <div className="flex items-center gap-2 text-white/60 text-sm font-mono">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        Sistema Operativo • {{systemStatus}}
      </div>
    </div>
    
    <div className="flex justify-between text-white/60 text-sm">
      <p>© 2026 {{brandName}}. Todos los derechos reservados.</p>
      <div className="flex gap-6">
        {links.map((link, i) => (
          <a key={i} href={link.href} className="hover:text-white transition-colors">{link.label}</a>
        ))}
      </div>
    </div>
  </div>
</footer>`
  },

  'navbar-floating': {
    id: 'navbar-floating',
    type: 'navbar-floating',
    name: 'Navbar Flotante',
    description: 'Navbar tipo píldora que cambia con scroll',
    props: {
      brandName: 'Brand',
      links: [{ label: 'Inicio', href: '/' }],
      cta: 'Comenzar'
    },
    code: `
<motion.nav 
  className={\`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full transition-all \${
    scrolled ? 'bg-white/80 backdrop-blur-lg shadow-lg' : 'bg-transparent'
  }\`}
  initial={{ y: -100 }}
  animate={{ y: 0 }}
  transition={{ type: 'spring', stiffness: 100 }}
>
  <div className="flex items-center gap-8">
    <span className={\`font-bold text-lg \${scrolled ? 'text-[#2E4036]' : 'text-white'}\`}>{{brandName}}</span>
    <div className="flex items-center gap-6">
      {links.map((link, i) => (
        <a key={i} href={link.href} className={\`text-sm \${scrolled ? 'text-gray-600 hover:text-[#2E4036]' : 'text-white/80 hover:text-white'}\`}>
          {link.label}
        </a>
      ))}
    </div>
    <button className="px-4 py-2 bg-[#CC5833] text-white text-sm font-semibold rounded-full hover:scale-105 transition-all">
      {{cta}}
    </button>
  </div>
</motion.nav>`
  }
}

// Función para generar código completo de una página
export function generatePageCode(sections: SectionType[], projectContext: any): string {
  const imports = `
'use client'

import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { CheckCircle, ChevronDown, Zap, Shield, Sparkles } from 'lucide-react'
`

  const sectionsCode = sections.map(sectionType => {
    const template = SECTION_TEMPLATES[sectionType]
    return template?.code || ''
  }).join('\n')

  return `${imports}

export default function Page() {
  const [scrolled, setScrolled] = useState(false)
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <main>
      ${sectionsCode}
    </main>
  )
}`
}
