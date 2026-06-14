// 🖼️ IMAGE SKILL - Búsqueda y generación de imágenes para proyectos
// Integra con Unsplash API y generación de placeholders premium

export interface ImageSearchResult {
  id: string
  url: string
  thumbnailUrl: string
  alt: string
  author: string
  source: 'unsplash' | 'generated' | 'placeholder'
}

export interface ImageRequest {
  query: string
  count?: number
  orientation?: 'landscape' | 'portrait' | 'square'
  style?: 'photo' | 'illustration' | 'minimal'
}

// Colecciones de imágenes por categoría para fallback
const IMAGE_COLLECTIONS: Record<string, string[]> = {
  ecommerce: [
    'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800',
    'https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=800',
    'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800',
    'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=800',
    'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=800',
  ],
  fashion: [
    'https://images.unsplash.com/photo-1469334031218-e382a71b716b?w=800',
    'https://images.unsplash.com/photo-1445205170230-053b83016050?w=800',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
    'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800',
    'https://images.unsplash.com/photo-1485968579169-a6f1e5b76949?w=800',
  ],
  technology: [
    'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800',
    'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800',
    'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=800',
    'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=800',
    'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800',
  ],
  art: [
    'https://images.unsplash.com/photo-1541961017774-22349e4a1262?w=800',
    'https://images.unsplash.com/photo-1578926375605-eaf7559b1458?w=800',
    'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800',
    'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=800',
    'https://images.unsplash.com/photo-1547826039-bfc35e0f1ea8?w=800',
  ],
  nature: [
    'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800',
    'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=800',
    'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800',
    'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=800',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800',
  ],
  food: [
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800',
    'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800',
    'https://i.pinimg.com/originals/f3/0a/1c/f30a1cd9f258fe356a8e7855abddac36.jpg',
    'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800',
    'https://images.unsplash.com/photo-1493770348161-369560ae357d?w=800',
  ],
  business: [
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800',
    'https://images.unsplash.com/photo-1560472355-536de3962603?w=800',
    'https://images.unsplash.com/photo-1573164713988-8665fc963095?w=800',
    'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800',
    'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=800',
  ],
  hero: [
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1600',
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1600',
    'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=1600',
    'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1600',
    'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=1600',
  ],
  abstract: [
    'https://images.unsplash.com/photo-1557672172-298e090bd0f1?w=800',
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800',
    'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800',
    'https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=800',
    'https://images.unsplash.com/photo-1604076913837-52ab5629fba9?w=800',
  ],
  people: [
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800',
    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=800',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800',
    'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=800',
  ],
  games: [
    'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=800',
    'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800',
    'https://thumbs.dreamstime.com/b/gaming-set-flat-design-kiber-sport-illustration-concept-game-environment-tools-essentials-various-devices-kiber-sport-73688864.jpg',
    'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800',
    'https://images.unsplash.com/photo-1612287230202-1ff1d85d1bdf?w=800',
  ],
  coffee: [
    'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800',
    'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800',
    'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800',
    'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800',
    'https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=800',
    'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=800',
    'https://images.unsplash.com/photo-1498804103079-a6351b050096?w=800',
    'https://images.unsplash.com/photo-1559496417-e7f25cb247f3?w=800',
  ],
  restaurant: [
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800',
    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800',
    'https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=800',
    'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800',
    'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800',
    'https://images.unsplash.com/photo-1537047902294-62a40c20a6ae?w=800',
  ],
  fitness: [
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800',
    'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=800',
    'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800',
    'https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=800',
    'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=800',
  ],
  realestate: [
    // Luxury homes exterior
    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800',
    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800',
    'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800',
    'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800',
    'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800',
    // Luxury interiors
    'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800',
    'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800',
    'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=800',
    'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800',
    // Pool / outdoor
    'https://images.unsplash.com/photo-1600573472550-8090b5e0745e?w=800',
    'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800',
    // Kitchen / bathroom luxury
    'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800',
    'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=800',
    // Penthouse / skyline views
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800',
    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800',
  ],
  travel: [
    'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800',
    'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800',
    'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800',
    'https://images.unsplash.com/photo-1530789253388-582c481c54b0?w=800',
  ],
}

// Detectar categoría de imagen basada en query
function detectCategory(query: string): string {
  const q = query.toLowerCase()
  
  if (q.includes('café') || q.includes('cafe') || q.includes('cafetería') || q.includes('cafeteria') || q.includes('coffee') || q.includes('barista')) return 'coffee'
  if (q.includes('restaurante') || q.includes('restaurant') || q.includes('cocina') || q.includes('chef') || q.includes('menú')) return 'restaurant'
  // Real estate BEFORE generic categories — has many specific keywords
  if (q.includes('inmobiliaria') || q.includes('real estate') || q.includes('apartamento') || q.includes('vivienda') || q.includes('propiedad') || q.includes('bienes raíces') || q.includes('bienes raices') || q.includes('penthouse') || q.includes('villa') || q.includes('mansión') || q.includes('mansion') || q.includes('residencia') || q.includes('lujo') || q.includes('luxury') || q.includes('casa')) return 'realestate'
  if (q.includes('tienda') || q.includes('producto') || q.includes('shop') || q.includes('ecommerce')) return 'ecommerce'
  if (q.includes('ropa') || q.includes('moda') || q.includes('fashion') || q.includes('vestido')) return 'fashion'
  if (q.includes('tech') || q.includes('código') || q.includes('software') || q.includes('ia') || q.includes('ai')) return 'technology'
  if (q.includes('arte') || q.includes('galería') || q.includes('pintura') || q.includes('art')) return 'art'
  if (q.includes('naturaleza') || q.includes('paisaje') || q.includes('nature')) return 'nature'
  if (q.includes('comida') || q.includes('food') || q.includes('gastronomía')) return 'food'
  if (q.includes('negocio') || q.includes('empresa') || q.includes('business') || q.includes('office') || q.includes('consulting')) return 'business'
  if (q.includes('gym') || q.includes('fitness') || q.includes('deporte') || q.includes('entrenamiento') || q.includes('yoga')) return 'fitness'
  if (q.includes('viaje') || q.includes('travel') || q.includes('turismo') || q.includes('hotel') || q.includes('playa')) return 'travel'
  if (q.includes('hero') || q.includes('banner') || q.includes('fondo')) return 'hero'
  if (q.includes('abstract') || q.includes('gradiente') || q.includes('patron')) return 'abstract'
  if (q.includes('persona') || q.includes('equipo') || q.includes('people') || q.includes('team')) return 'people'
  if (q.includes('juego') || q.includes('game') || q.includes('gaming')) return 'games'
  
  return 'hero' // Default
}

// Buscar imágenes por query
export async function searchImages(request: ImageRequest): Promise<ImageSearchResult[]> {
  const { query, count = 5 } = request
  const category = detectCategory(query)
  const images = IMAGE_COLLECTIONS[category] || IMAGE_COLLECTIONS.hero
  
  // Seleccionar imágenes aleatorias de la colección
  const shuffled = [...images].sort(() => Math.random() - 0.5)
  const selected = shuffled.slice(0, Math.min(count, images.length))
  
  return selected.map((url, index) => ({
    id: `img-${category}-${index}`,
    url,
    thumbnailUrl: url.replace('w=800', 'w=400').replace('w=1600', 'w=800'),
    alt: `${category} image ${index + 1}`,
    author: 'Unsplash',
    source: 'unsplash' as const,
  }))
}

// Generar imagen con IA (usando RouteLLM)
export async function generateImage(
  prompt: string,
  style: 'realistic' | 'artistic' | 'minimal' = 'artistic'
): Promise<ImageSearchResult | null> {
  try {
    const stylePrompts = {
      realistic: 'photorealistic, high quality, 8k, detailed',
      artistic: 'artistic, creative, modern design, premium aesthetic',
      minimal: 'minimalist, clean, simple, elegant',
    }
    
    const fullPrompt = `${prompt}, ${stylePrompts[style]}, professional quality`
    
    const response = await fetch('https://apps.abacus.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ABACUSAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4.1',
        messages: [
          { role: 'user', content: fullPrompt }
        ],
        modalities: ['image'],
        image_config: {
          size: '1024x1024',
          quality: 'high',
        },
      }),
    })
    
    if (!response.ok) {
      console.error('Image generation failed:', await response.text())
      return null
    }
    
    const result = await response.json()
    const imageUrl = result.choices?.[0]?.message?.image_url || result.image_url
    
    if (imageUrl) {
      return {
        id: `generated-${Date.now()}`,
        url: imageUrl,
        thumbnailUrl: imageUrl,
        alt: prompt,
        author: 'AI Generated',
        source: 'generated',
      }
    }
    
    return null
  } catch (error) {
    console.error('Error generating image:', error)
    return null
  }
}

// Obtener imágenes para un proyecto específico
export async function getProjectImages(
  projectType: string,
  projectName: string,
  sections: string[]
): Promise<Record<string, ImageSearchResult[]>> {
  const imagesBySection: Record<string, ImageSearchResult[]> = {}
  
  // Imágenes para Hero
  if (sections.includes('hero-cinematic') || sections.includes('hero-split')) {
    imagesBySection.hero = await searchImages({ 
      query: `${projectName} hero banner ${projectType}`,
      count: 3,
    })
  }
  
  // Imágenes para Features
  if (sections.some(s => s.includes('features'))) {
    imagesBySection.features = await searchImages({ 
      query: `${projectType} features icons`,
      count: 6,
    })
  }
  
  // Imágenes para Testimonios
  if (sections.includes('testimonials-carousel') || sections.includes('testimonials-grid')) {
    imagesBySection.testimonials = await searchImages({ 
      query: 'professional people portraits',
      count: 4,
    })
  }
  
  // Imágenes para productos (ecommerce)
  if (projectType === 'ecommerce') {
    imagesBySection.products = await searchImages({ 
      query: `${projectName} products`,
      count: 8,
    })
  }
  
  // Imágenes para galería (art/portfolio)
  if (projectType === 'portfolio' || projectName.toLowerCase().includes('galeria')) {
    imagesBySection.gallery = await searchImages({ 
      query: 'art gallery contemporary',
      count: 12,
    })
  }
  
  // Imágenes para propiedades (real estate)
  if (projectType === 'realestate') {
    imagesBySection.properties = await searchImages({ 
      query: 'luxury real estate mansion villa penthouse',
      count: 8,
    })
    imagesBySection.gallery = await searchImages({ 
      query: 'luxury real estate interior',
      count: 6,
    })
  }
  
  return imagesBySection
}

// Exportar skill info para el sistema
export const IMAGE_SKILL_INFO = {
  id: 'image-skill',
  name: '🖼️ Image Skill',
  description: 'Busca y genera imágenes profesionales para proyectos',
  capabilities: [
    'Búsqueda de imágenes por categoría',
    'Generación de imágenes con IA',
    'Selección automática por tipo de proyecto',
    'Optimización de tamaños',
  ],
  status: 'active' as const,
}
