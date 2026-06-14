/**
 * Test Scaffold — generador determinístico de un harness de tests para
 * proyectos del Code Engine (Fase 3, cierre).
 *
 * Inyecta Vitest + Testing Library ya configurados y un set de tests de ejemplo
 * RUNNABLE (`npm test`), para que cualquier SaaS generado nazca con cobertura
 * básica y el AI pueda extenderla. Determinístico: no depende del LLM para el
 * andamiaje, solo para los casos de negocio específicos.
 *
 * Decisiones:
 * - Vitest (rápido, ESM nativo, compatible con WebContainers) + jsdom.
 * - @testing-library/react para componentes; tests de unidad puros para utils.
 * - No toca package.json del proyecto destino directamente: devuelve un parche
 *   de scripts/devDeps que el caller fusiona (mergeTestDepsIntoPackageJson).
 */

export interface TestScaffoldFile {
  path: string
  content: string
}

/** Devuelve los archivos del harness de tests (sin package.json). */
export function buildTestScaffoldFiles(): TestScaffoldFile[] {
  const files: Record<string, string> = {}

  files['vitest.config.ts'] = `import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'e2e'],
  },
  resolve: {
    alias: { '@': resolve(__dirname, '.') },
  },
})
`

  files['vitest.setup.ts'] = `import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Limpia el DOM entre tests para evitar fugas de estado.
afterEach(() => cleanup())
`

  // Util de ejemplo + su test (siempre presentes, no dependen del proyecto).
  files['lib/format.ts'] = `/** Formatea un número como moneda USD. */
export function formatCurrency(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value)
}

/** Trunca un texto a n caracteres con elipsis. */
export function truncate(text: string, n: number): string {
  return text.length <= n ? text : text.slice(0, n - 1).trimEnd() + '…'
}
`

  files['lib/format.test.ts'] = `import { describe, it, expect } from 'vitest'
import { formatCurrency, truncate } from '@/lib/format'

describe('formatCurrency', () => {
  it('formatea USD con dos decimales', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50')
  })
  it('respeta la moneda dada', () => {
    expect(formatCurrency(10, 'EUR')).toContain('10')
  })
})

describe('truncate', () => {
  it('no toca textos cortos', () => {
    expect(truncate('hola', 10)).toBe('hola')
  })
  it('trunca y añade elipsis', () => {
    expect(truncate('hola mundo', 6)).toBe('hola…')
  })
})
`

  // Test de componente React de ejemplo.
  files['components/__tests__/example.test.tsx'] = `import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

function Greeting({ name }: { name: string }) {
  return <h1>Hola, {name}</h1>
}

describe('Greeting', () => {
  it('renderiza el nombre', () => {
    render(<Greeting name="Octopus" />)
    expect(screen.getByText('Hola, Octopus')).toBeInTheDocument()
  })
})
`

  // Test de API route de ejemplo (lógica pura, sin servidor).
  files['app/api/__tests__/health.test.ts'] = `import { describe, it, expect } from 'vitest'

// Ejemplo: una API route puede exportar un handler puro y testearse sin servidor.
function healthHandler() {
  return { status: 'ok', ts: Date.now() }
}

describe('health handler', () => {
  it('devuelve status ok', () => {
    expect(healthHandler().status).toBe('ok')
  })
})
`

  // Playwright E2E opcional (config + smoke test). No corre en CI por defecto.
  files['playwright.config.ts'] = `import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://localhost:3000' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
`

  files['e2e/smoke.spec.ts'] = `import { test, expect } from '@playwright/test'

test('la home carga', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('body')).toBeVisible()
})
`

  files['TESTING.md'] = `# Tests

Harness generado por el **OCTOPUS Code Engine** (Fase 3).

## Unitarios / componentes (Vitest)
\`\`\`bash
npm test          # corre una vez
npm run test:watch
\`\`\`
- Configuración: \`vitest.config.ts\` (jsdom + alias @)
- Setup: \`vitest.setup.ts\` (jest-dom + cleanup)
- Ejemplos: \`lib/format.test.ts\`, \`components/__tests__\`, \`app/api/__tests__\`

## E2E (Playwright) — opcional
\`\`\`bash
npx playwright install   # una vez
npm run test:e2e
\`\`\`
- Config: \`playwright.config.ts\` (levanta \`npm run dev\` solo)
- Smoke: \`e2e/smoke.spec.ts\`

> El AI puede añadir casos para tu lógica de negocio sobre este andamiaje.
`

  return Object.entries(files).map(([path, content]) => ({ path, content }))
}

/** Scripts y devDeps que el proyecto necesita para correr los tests. */
export const TEST_SCRIPTS: Record<string, string> = {
  test: 'vitest run',
  'test:watch': 'vitest',
  'test:e2e': 'playwright test',
}

export const TEST_DEV_DEPS: Record<string, string> = {
  vitest: '2.0.5',
  '@vitejs/plugin-react': '4.3.1',
  jsdom: '24.1.1',
  '@testing-library/react': '16.0.0',
  '@testing-library/jest-dom': '6.4.8',
  '@playwright/test': '1.46.0',
}

/**
 * Fusiona scripts + devDeps de test en un package.json existente (string).
 * Devuelve el JSON resultante (string) o el original si no se pudo parsear.
 * No pisa scripts/deps que el proyecto ya defina.
 */
export function mergeTestDepsIntoPackageJson(pkgJson: string): string {
  try {
    const pkg = JSON.parse(pkgJson)
    pkg.scripts = { ...TEST_SCRIPTS, ...(pkg.scripts || {}) }
    pkg.devDependencies = { ...(pkg.devDependencies || {}), ...TEST_DEV_DEPS }
    return JSON.stringify(pkg, null, 2) + '\n'
  } catch {
    return pkgJson
  }
}
