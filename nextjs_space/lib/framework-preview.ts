/**
 * Framework Preview — Multi-Framework In-Browser Transpilation Engine
 *
 * Renders React / Vue 3 / Svelte / Vanilla JS projects directly in the iframe
 * WITHOUT npm install or dev server.
 *
 * Strategy per framework:
 *  React:   Babel standalone + esm.sh import maps + Tailwind CDN
 *  Vue 3:   Vue global build (includes template compiler) + SFC parsing
 *  Svelte:  Svelte compiler (esm.sh) + component compilation in-iframe
 *  Vanilla: ES module bundling with import map resolution
 *
 * Phase 6 — Asset Pipeline:
 *  - Generated images injected via path→URL map (blob/CDN URLs available in preview)
 *  - Icon library CDN auto-detection (Lucide, FontAwesome, Material, Heroicons, etc.)
 *  - Google Fonts enrichment from CSS + code references
 *  - SVG files inlined as data URIs
 *  - In-browser API mock server (fetch/XHR intercept for .json file data)
 */

interface FileEntry {
  path: string
  content: string
}

interface ImportInfo {
  def?: string
  named: Set<string>
  star?: string
}

// React version pinned for consistent module deduplication
const REACT_VER = '18.3.1'

// Packages to exclude from import map (build tools, types, etc.)
const BUILD_ONLY = new Set([
  'typescript', 'vite', '@vitejs/plugin-react', '@vitejs/plugin-react-swc',
  'tailwindcss', 'postcss', 'autoprefixer', 'eslint', 'prettier',
  '@types/react', '@types/react-dom', '@types/node',
  'sass', 'less', '@tailwindcss/typography', '@tailwindcss/forms',
  'vitest', 'jest', '@testing-library/react',
  // Next.js core (handled via stubs, not esm.sh)
  'next', 'next-auth', '@next/font',
])

// ── Next.js / Platform Stubs for in-browser preview ──────────────────────────
// When Code Engine generates platform-aware code (using @/lib/*, next/*),
// these stubs allow the preview to render without a real Next.js server.
const NEXTJS_STUBS: Record<string, string> = {
  'next/link': `data:text/javascript,
    import React from 'react';
    const Link = React.forwardRef(({href,children,...props},ref) =>
      React.createElement('a',{...props,ref,href:typeof href==='string'?href:'#',onClick:e=>{e.preventDefault();}},children));
    Link.displayName='Link';
    export default Link;`,
  'next/image': `data:text/javascript,
    import React from 'react';
    const Image = React.forwardRef(({src,alt,width,height,fill,className,style,...props},ref) =>
      React.createElement('img',{ref,src:typeof src==='string'?src:'',alt:alt||'',
        width:fill?undefined:width,height:fill?undefined:height,
        className,style:{...style,...(fill?{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover'}:{})},
        loading:'lazy',...props}));
    Image.displayName='Image';
    export default Image;`,
  'next/navigation': `data:text/javascript,
    export function useRouter(){return{push:()=>{},replace:()=>{},back:()=>{},forward:()=>{},refresh:()=>{},prefetch:()=>{}}}
    export function usePathname(){return '/'}
    export function useSearchParams(){return new URLSearchParams()}
    export function useParams(){return{}}
    export function redirect(){};
    export function notFound(){};`,
  'next/router': `data:text/javascript,
    export function useRouter(){return{push:()=>{},replace:()=>{},back:()=>{},pathname:'/',query:{},asPath:'/'}}
    export default{push:()=>{},replace:()=>{}};`,
  'next-auth/react': `data:text/javascript,
    import React from 'react';
    const mockSession={user:{name:'Preview User',email:'preview@test.com',image:null},expires:'2099-01-01'};
    export function useSession(){return{data:mockSession,status:'authenticated'}}
    export function signIn(){return Promise.resolve()}
    export function signOut(){return Promise.resolve()}
    export function SessionProvider({children}){return children}
    export function getSession(){return Promise.resolve(mockSession)};`,
  'next/head': `data:text/javascript,
    export default function Head({children}){return null};`,
  'next/dynamic': `data:text/javascript,
    import React from 'react';
    export default function dynamic(loader){const C=React.lazy(loader);return function DynWrap(p){return React.createElement(React.Suspense,{fallback:null},React.createElement(C,p))}};`,
  'next/font/google': `data:text/javascript,
    export function Inter(){return{className:'font-inter',style:{fontFamily:'Inter,system-ui,sans-serif'}}}
    export function Roboto(){return{className:'font-roboto',style:{fontFamily:'Roboto,system-ui,sans-serif'}}}
    export function Poppins(){return{className:'font-poppins',style:{fontFamily:'Poppins,system-ui,sans-serif'}}};`,
  'next/server': `data:text/javascript,
    export class NextRequest extends Request{constructor(...a){super(...a);this.nextUrl=new URL(this.url)}}
    export class NextResponse extends Response{static json(d,i){return new Response(JSON.stringify(d),{...i,headers:{'content-type':'application/json',...(i?.headers||{})}})}static redirect(u){return new Response(null,{status:307,headers:{Location:String(u)}})}};`,
}

// Platform alias stubs — when code imports @/lib/prisma, @/lib/auth, etc.
const PLATFORM_ALIAS_STUBS: Record<string, string> = {
  '@/lib/prisma': `data:text/javascript,
    const handler={get:(t,p)=>typeof p==='string'?new Proxy(()=>{},{get:()=>()=>Promise.resolve([]),apply:()=>Promise.resolve(null)}):undefined};
    export const prisma=new Proxy({},handler);export default prisma;`,
  '@/lib/auth': `data:text/javascript,
    export const authOptions={providers:[],callbacks:{}};
    export async function getServerSession(){return{user:{name:'Preview',email:'preview@test.com'}}};`,
  '@/lib/stripe': `data:text/javascript,
    const handler={get:()=>({list:()=>Promise.resolve({data:[]}),create:()=>Promise.resolve({}),retrieve:()=>Promise.resolve({})})};
    export const stripe=new Proxy({},handler);`,
  '@/lib/turbo-llm': `data:text/javascript,
    export async function callLLM(opts){return'[Preview mode — LLM not available]'};`,
  '@/lib/utils': `data:text/javascript,
    export function cn(...inputs){return inputs.flat(Infinity).filter(Boolean).join(' ').replace(/\\s+/g,' ').trim()}
    export function formatDate(d){return new Date(d).toLocaleDateString()}
    export function sleep(ms){return new Promise(r=>setTimeout(r,ms))};`,
  '@/lib/s3': `data:text/javascript,
    export async function uploadToS3(){return{url:'#preview',key:'preview'}}
    export async function getSignedUrl(){return '#preview'};`,
  '@/lib/plan-gate': `data:text/javascript,
    export async function checkPlanGate(){return{allowed:true}};`,
  '@/lib/plan-limits': `data:text/javascript,
    export const PLAN_LIMITS={free:{},pro:{},enterprise:{}};`,
}

// Files to skip (config/meta, not needed for preview)
const SKIP_FILE = /(?:package\.json|tsconfig[^/]*\.json|vite\.config\.|tailwind\.config\.|postcss\.config\.|babel\.config|\.[ep]slintrc|\.prettierrc|\.gitignore|\.env)/i

/** Sort priority — lower runs first */
function filePriority(p: string): number {
  if (/lib\/|utils\./i.test(p)) return 0
  if (/animations?\./i.test(p)) return 1
  if (/hooks?\//i.test(p)) return 2
  if (/context\//i.test(p)) return 3
  if (/components?\//i.test(p)) return 4
  if (/App\.[tjx]/i.test(p)) return 5
  if (/main\.[tjx]/i.test(p)) return 6
  if (/index\.[tjx]/i.test(p)) return 7
  return 4
}

/**
 * Process a code file:
 * - Separate npm imports (collected) from local imports (stripped)
 * - Strip export keywords
 * Returns cleaned code and collected npm imports.
 */
/**
 * Strip brace-balanced blocks matched by a pattern (e.g. interface/type/enum).
 * The regex must match the opening line including `{`.
 * We then count braces to find the matching `}`.
 */
function stripBracedBlock(src: string, openRe: RegExp): string {
  // Reset lastIndex for global regexes
  openRe.lastIndex = 0
  let result = src
  // Iterate from bottom to preserve indices
  const matches: { start: number; end: number }[] = []
  let m: RegExpExecArray | null
  while ((m = openRe.exec(src)) !== null) {
    const start = m.index
    let depth = 0
    let end = start
    for (let i = start; i < src.length; i++) {
      if (src[i] === '{') depth++
      else if (src[i] === '}') {
        depth--
        if (depth === 0) { end = i + 1; break }
      }
    }
    if (depth === 0 && end > start) matches.push({ start, end })
  }
  // Remove from end to start to preserve offsets
  for (let i = matches.length - 1; i >= 0; i--) {
    result = result.slice(0, matches[i].start) + result.slice(matches[i].end)
  }
  return result
}

function processCodeFile(content: string): { code: string; npmImports: Map<string, ImportInfo> } {
  const npmImports = new Map<string, ImportInfo>()

  let code = content

  // Strip import statements, collecting npm ones
  code = code.replace(
    /^import\s+(.+?)\s+from\s+['"]([^'"]+)['"];?\s*$/gm,
    (_match, clause, pkg) => {
      const cl = clause.trim()

      // Type-only import → remove
      if (/^type\s/.test(cl)) return ''

      // Platform alias import (@/lib/*) → keep as npm import if stub exists
      if (PLATFORM_ALIAS_STUBS[pkg]) {
        if (!npmImports.has(pkg)) npmImports.set(pkg, { named: new Set() })
        const info = npmImports.get(pkg)!
        // Parse the clause to collect named/default imports
        const namedM = cl.match(/^\{([^}]+)\}$/)
        if (namedM) { namedM[1].split(',').forEach(n => { const t = n.trim(); if (t && !t.startsWith('type ')) info.named.add(t) }); return '' }
        const bothM = cl.match(/^(\w+)\s*,\s*\{([^}]+)\}$/)
        if (bothM) { info.def = bothM[1]; bothM[2].split(',').forEach(n => { const t = n.trim(); if (t && !t.startsWith('type ')) info.named.add(t) }); return '' }
        if (/^\w+$/.test(cl)) { info.def = cl; return '' }
        return ''
      }

      // Local/relative/alias import → remove (code is inlined)
      // Note: @scope/package (npm scoped) must NOT be stripped — only @/ @./ @~ (aliases)
      if (/^[.~\/]/.test(pkg) || /^@[\/.]/.test(pkg) || pkg.startsWith('#')) return ''

      // npm import → collect
      if (!npmImports.has(pkg)) npmImports.set(pkg, { named: new Set() })
      const info = npmImports.get(pkg)!

      // import * as X
      const starM = cl.match(/^\*\s+as\s+(\w+)$/)
      if (starM) { info.star = starM[1]; return '' }

      // import Default, { named }
      const bothM = cl.match(/^(\w+)\s*,\s*\{([^}]+)\}$/)
      if (bothM) {
        info.def = bothM[1]
        bothM[2].split(',').forEach(n => {
          const t = n.trim()
          if (t && !t.startsWith('type ')) info.named.add(t)
        })
        return ''
      }

      // import { named }
      const namedM = cl.match(/^\{([^}]+)\}$/)
      if (namedM) {
        namedM[1].split(',').forEach(n => {
          const t = n.trim()
          if (t && !t.startsWith('type ')) info.named.add(t)
        })
        return ''
      }

      // import Default
      if (/^\w+$/.test(cl)) { info.def = cl; return '' }

      return '' // unknown pattern
    },
  )

  // Strip CSS/side-effect imports: import './styles.css'
  code = code.replace(/^import\s+['"][^'"]+['"];?\s*$/gm, '')

  // Transform lazy(() => import('pkg')) → eager wrapper using the imported module
  // This allows React.lazy components with npm packages to work in the preview
  code = code.replace(
    /(?:const|let|var)\s+(\w+)\s*=\s*lazy\s*\(\s*\(\)\s*=>\s*import\s*\(\s*['"]([^'"]+)['"]\s*\)\s*\)/g,
    (_match, varName, pkg) => {
      // If it's a local import, just create a passthrough
      if (/^[.~\/]/.test(pkg) || /^@[\/.]/.test(pkg)) {
        return `/* lazy local: ${pkg} stripped */`
      }
      // For npm packages: collect as dependency and create a sync wrapper
      const scopedPkg = pkg.split('/').slice(0, pkg.startsWith('@') ? 2 : 1).join('/')
      if (!npmImports.has(scopedPkg)) npmImports.set(scopedPkg, { named: new Set() })
      const info = npmImports.get(scopedPkg)!
      if (!info.def) info.def = `__lazy_${varName}`
      return `const ${varName} = { $$typeof: Symbol.for('react.forward_ref'), render: (props, ref) => React.createElement(__lazy_${varName}.default || __lazy_${varName}, { ...props, ref }) }`
    },
  )

  // Strip export keywords (make everything available in scope)
  code = code
    .replace(/^export\s+default\s+function\s/gm, 'function ')
    .replace(/^export\s+default\s+class\s/gm, 'class ')
    .replace(/^export\s+default\s+/gm, '/* default */ ')
    .replace(/^export\s+(function|class|const|let|var)\s/gm, '$1 ')
    .replace(/^export\s+\{[^}]*\}\s*;?\s*$/gm, '')

  // ── Strip TypeScript declarations that cause "already declared" in flattened code ──
  // Remove `interface Foo { ... }` (multi-line, brace-balanced)
  code = stripBracedBlock(code, /^(?:export\s+)?interface\s+\w+[^{]*\{/gm)
  // Remove `type Foo = { ... }` (object types)
  code = stripBracedBlock(code, /^(?:export\s+)?type\s+\w+[^=]*=\s*\{/gm)
  // Remove `type Foo = ...;` (simple aliases like `type Foo = string | number;`)
  code = code.replace(/^(?:export\s+)?type\s+\w+\s*(?:<[^>]*>)?\s*=[^{][^\n]*;?\s*$/gm, '')
  // Remove `enum Foo { ... }`
  code = stripBracedBlock(code, /^(?:export\s+)?(?:const\s+)?enum\s+\w+\s*\{/gm)
  // Remove `: TypeAnnotation` from const/let/var declarations (e.g. `const x: Foo =`)
  code = code.replace(/^((?:const|let|var)\s+\w+)\s*:\s*[\w<>\[\]|&.\s,()=>'"]+(?=\s*=)/gm, '$1')
  // Remove `as Type` casts (e.g. `value as string`)
  code = code.replace(/\bas\s+(?:const|[\w<>\[\]|&.]+)(?=[;,)\]\s}])/g, '')
  // Remove React.FC<Props> / React.forwardRef<...> type annotations from arrow consts
  // Handles nested generics: React.FC<React.HTMLAttributes<HTMLDivElement>>
  code = code.replace(/(const\s+\w+)\s*:\s*React\.(?:FC|FunctionComponent|VFC|ComponentType)\s*<(?:[^<>]|<[^>]*>)*>\s*=/g, '$1 =')
  // Remove React.forwardRef<Type, Props> generic params (keep the call)
  // Handles nested: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>
  code = code.replace(/React\.forwardRef<(?:[^<>]|<[^>]*>)*>/g, 'React.forwardRef')
  // Remove generic type params from function declarations: function foo<T extends Bar<Baz>>(
  code = code.replace(/(function\s+\w+)\s*<(?:[^<>(]|<[^>]*>)*>\s*\(/g, '$1(')
  // Remove param type annotations: (param: Type) → (param)
  code = code.replace(/(\((?:[^()]*,\s*)?(?:\.\.\.)?\w+)\s*:\s*[\w<>\[\]|&.\s,()=>'"?]+(?=[,)])/g, '$1')
  // Remove return type annotations: ) : Type => or ): Type {
  code = code.replace(/\)\s*:\s*[\w<>\[\]|&.\s,()=>'"]+(?=\s*(?:=>|\{))/g, ')')
  // Remove `!` non-null assertions (e.g. `ref.current!.focus()`)
  code = code.replace(/(\w+)!\./g, '$1.')
  // Remove `satisfies Type` (e.g. `config satisfies Config`)
  code = code.replace(/\bsatisfies\s+[\w<>\[\]|&.\s,()=>'"]+(?=[;,)\]\s}])/g, '')
  // Remove `declare` statements (e.g. `declare module 'foo'`, `declare const x: Foo`)
  code = code.replace(/^declare\s+(?:module|namespace|global)\s+[\s\S]*?(?=\n(?:import|export|const|let|var|function|class|\S))/gm, '')
  code = code.replace(/^declare\s+(?:const|let|var|function|class|type|interface|enum)\s+[^\n]+$/gm, '')
  // Remove function overload signatures (lines ending with just `;` after a function signature)
  code = code.replace(/^(?:export\s+)?function\s+\w+[^{]*;\s*$/gm, '')
  // Remove `readonly` modifier from property declarations
  code = code.replace(/\breadonly\s+(?=\w)/g, '')
  // Remove type assertions with angle brackets: <Type>value (avoid JSX conflict by requiring preceding = or ( or , or return)
  code = code.replace(/(?<=[=(,\s])<[\w<>\[\]|&.\s,]+>(?=\w)/g, '')
  // Remove `keyof typeof` / `typeof x` in type positions
  code = code.replace(/:\s*(?:keyof\s+)?typeof\s+\w+/g, '')
  // Handle destructured param types: ({ a, b }: Props) → ({ a, b })
  code = code.replace(/(\}\s*):\s*[\w<>\[\]|&.\s]+(?=[,)])/g, '$1')

  return { code: code.trim(), npmImports }
}

/**
 * Process CSS files:
 * - Strip @tailwind directives (CDN handles them)
 * - Convert @fontsource to Google Fonts links
 * - Extract @import url() for external fonts
 */
function processCSS(cssFiles: FileEntry[]): { css: string; fontLinks: string[] } {
  const fontLinksSet = new Set<string>()
  let css = ''

  for (const file of cssFiles) {
    let c = file.content

    // @fontsource → Google Fonts
    c = c.replace(/@import\s+['"]@fontsource[^'"]*['"];?/g, (m) => {
      const fontMatch = m.match(/@fontsource(?:-variable)?\/([^/'"]+)/)
      if (fontMatch) {
        const family = fontMatch[1]
          .replace(/-/g, '+')
          .replace(/\b\w/g, (x) => x.toUpperCase())
        fontLinksSet.add(
          `https://fonts.googleapis.com/css2?family=${family}:wght@300;400;500;600;700&display=swap`,
        )
      }
      return ''
    })

    // External @import url() for fonts
    c = c.replace(/@import\s+url\(['"]?([^'"\)\s]+)['"]?\)\s*;?/g, (_, url) => {
      if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
        fontLinksSet.add(url)
      }
      return ''
    })

    // Strip @tailwind directives
    c = c.replace(/@tailwind\s+\w+\s*;?/g, '')

    const trimmed = c.trim()
    if (trimmed) css += `/* ${file.path} */\n${trimmed}\n\n`
  }

  return { css, fontLinks: Array.from(fontLinksSet) }
}

/**
 * Generate consolidated import statements from collected imports.
 */
function generateImports(
  npmImports: Map<string, ImportInfo>,
  importMap: Record<string, string>,
): string {
  const lines: string[] = []
  for (const [pkg, info] of npmImports) {
    // Ensure the import map has this package
    if (!importMap[pkg]) {
      importMap[pkg] = `https://esm.sh/${pkg}`
    }

    if (info.star) {
      lines.push(`import * as ${info.star} from '${pkg}'`)
      continue
    }
    const parts: string[] = []
    if (info.def) parts.push(info.def)
    if (info.named.size > 0) parts.push(`{ ${Array.from(info.named).join(', ')} }`)
    if (parts.length > 0) lines.push(`import ${parts.join(', ')} from '${pkg}'`)
  }
  return lines.join(';\n')
}

// ─── HMR Helpers (Phase 4) ────────────────────────────────────────────────────

/** Generate code to cache imported npm modules on window for HMR reuse */
function generateModuleRegistration(npmImports: Map<string, ImportInfo>): string {
  const lines: string[] = ['window.__ocModules = {};']
  for (const [pkg, info] of npmImports) {
    const props: string[] = []
    if (info.def) props.push(`'default': ${info.def}`)
    if (info.star) props.push(`...${info.star}`)
    for (const n of info.named) {
      const asM = n.match(/^(.+?)\s+as\s+(.+)$/)
      if (asM) props.push(`'${asM[1].trim()}': ${asM[2].trim()}`)
      else props.push(`'${n}': ${n}`)
    }
    if (props.length) lines.push(`window.__ocModules['${pkg}'] = { ${props.join(', ')} };`)
  }
  return lines.join('\n')
}

/** Generate var declarations that destructure cached modules for HMR eval context */
function generateHMRGlobals(npmImports: Map<string, ImportInfo>): string {
  const lines: string[] = ['var __M = window.__ocModules || {};']
  for (const [pkg, info] of npmImports) {
    if (info.def) {
      lines.push(`var ${info.def} = __M['${pkg}'] ? (__M['${pkg}']['default'] !== undefined ? __M['${pkg}']['default'] : __M['${pkg}']) : undefined;`)
    }
    if (info.star) {
      lines.push(`var ${info.star} = __M['${pkg}'] || {};`)
    }
    if (info.named.size > 0) {
      const names = Array.from(info.named).map(n => {
        const asM = n.match(/^(.+?)\s+as\s+(.+)$/)
        return asM ? `${asM[1].trim()}: ${asM[2].trim()}` : n
      })
      lines.push(`var { ${names.join(', ')} } = __M['${pkg}'] || {};`)
    }
  }
  return lines.join('\n')
}

/** Classify file changes between two maps for HMR strategy */
export function classifyFileChanges(
  prev: Map<string, string>,
  curr: Map<string, string>,
): 'none' | 'css' | 'js' | 'structural' {
  if (prev.size !== curr.size) return 'structural'
  for (const p of curr.keys()) {
    if (!prev.has(p)) return 'structural'
  }
  let cssChanged = false, jsChanged = false
  for (const [path, content] of curr) {
    if (prev.get(path) !== content) {
      if (/\.css$/i.test(path)) cssChanged = true
      else jsChanged = true
    }
  }
  if (!cssChanged && !jsChanged) return 'none'
  return jsChanged ? 'js' : 'css'
}

// ─── Shared HTML Fragments ──────────────────────────────────────────────────

/** Loading spinner overlay */
function loadingOverlay(label: string): string {
  return `<div id="__pld" style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#0a0a0f;z-index:9999;transition:opacity .3s">
<div style="text-align:center;color:#a78bfa">
<div style="width:36px;height:36px;border:3px solid #7c3aed;border-top-color:transparent;border-radius:50%;animation:__s 1s linear infinite;margin:0 auto 10px"></div>
<div style="font-size:12px;opacity:.7">${label}</div>
</div>
</div>
<style>@keyframes __s{to{transform:rotate(360deg)}}</style>`
}

/** Console capture + error overlay script (shared across all frameworks) */
const CONSOLE_CAPTURE_SCRIPT = `<script>
(function(){
  var MAX=200, logs=[], errCount=0;
  function send(level,args){
    var parts=[];
    for(var i=0;i<args.length;i++){
      try{
        var v=args[i];
        if(v===null) parts.push('null');
        else if(v===undefined) parts.push('undefined');
        else if(v instanceof Error) parts.push(v.stack||v.message||String(v));
        else if(typeof v==='object') parts.push(JSON.stringify(v,null,2));
        else parts.push(String(v));
      }catch(e){parts.push('[unserializable]')}
    }
    var entry={type:'__oc_console',level:level,message:parts.join(' '),ts:Date.now()};
    logs.push(entry);
    if(logs.length>MAX) logs.shift();
    try{parent.postMessage(entry,'*')}catch(e){}
    if(level==='error'){errCount++;showOverlay(parts.join(' '))}
  }
  var _log=console.log,_warn=console.warn,_err=console.error,_info=console.info;
  console.log=function(){_log.apply(console,arguments);send('log',arguments)};
  console.warn=function(){_warn.apply(console,arguments);send('warn',arguments)};
  console.error=function(){_err.apply(console,arguments);send('error',arguments)};
  console.info=function(){_info.apply(console,arguments);send('info',arguments)};
  var overlay=null;
  function showOverlay(msg){
    if(!overlay){
      overlay=document.createElement('div');
      overlay.id='__oc_err_overlay';
      overlay.style.cssText='position:fixed;bottom:0;left:0;right:0;max-height:45vh;overflow-y:auto;background:rgba(15,0,5,0.97);border-top:2px solid #dc2626;z-index:99999;font-family:ui-monospace,monospace;font-size:12px;color:#fca5a5;padding:0;backdrop-filter:blur(8px);display:flex;flex-direction:column';
      var hdr=document.createElement('div');
      hdr.style.cssText='display:flex;align-items:center;justify-content:space-between;padding:8px 14px;background:rgba(220,38,38,0.15);border-bottom:1px solid rgba(220,38,38,0.25);position:sticky;top:0';
      hdr.innerHTML='<span style="font-weight:600;color:#f87171;font-size:11px">⚠ Runtime Errors</span>';
      var btn=document.createElement('button');
      btn.textContent='\\u2715';
      btn.style.cssText='background:none;border:none;color:#f87171;cursor:pointer;font-size:14px;padding:2px 6px;border-radius:4px;opacity:0.7';
      btn.onmouseover=function(){this.style.opacity='1';this.style.background='rgba(220,38,38,0.2)'};
      btn.onmouseout=function(){this.style.opacity='0.7';this.style.background='none'};
      btn.onclick=function(){overlay.style.display='none';try{parent.postMessage({type:'__oc_overlay_dismissed'},'*')}catch(e){}};
      hdr.appendChild(btn);
      overlay.appendChild(hdr);
      var body=document.createElement('div');
      body.id='__oc_err_body';
      body.style.cssText='padding:10px 14px;overflow-y:auto;flex:1';
      overlay.appendChild(body);
      document.body.appendChild(overlay);
    }
    overlay.style.display='flex';
    var body=document.getElementById('__oc_err_body');
    if(body){
      var row=document.createElement('div');
      row.style.cssText='padding:6px 0;border-bottom:1px solid rgba(127,29,29,0.25);white-space:pre-wrap;word-break:break-all;line-height:1.6;color:#fca5a5';
      row.textContent=msg;
      body.appendChild(row);
    }
  }
  window.onerror=function(m,s,l,c,e){
    send('error',[m+(s?'\\n  at '+s+':'+l+':'+c:'')]);
    var el=document.getElementById('__pld');
    if(el){el.innerHTML='<div style="text-align:center;color:#f87171;padding:24px;max-width:440px"><div style="font-size:20px;margin-bottom:8px">⚠️</div><div style="font-size:13px;font-weight:600;margin-bottom:6px">Preview error</div><div style="font-size:11px;color:#a1a1aa;word-break:break-all;line-height:1.5">'+(m||'Unknown error')+'</div></div>'}
  };
  window.addEventListener('unhandledrejection',function(ev){
    var msg=ev.reason?(ev.reason.stack||ev.reason.message||String(ev.reason)):String(ev);
    send('error',['Unhandled Promise Rejection: '+msg]);
  });
  setTimeout(function(){var el=document.getElementById('__pld');if(el){el.style.opacity='0';setTimeout(function(){el.remove()},300)}},20000);
})();
</script>`

/** CSS-only HMR handler (shared — all frameworks support CSS hot swap) */
const CSS_HMR_SCRIPT = `<script>
(function(){
  window.addEventListener('message', function(ev){
    if(!ev.data || ev.data.type !== '__oc_hot_update') return;
    if(ev.data.kind === 'css'){
      var s = document.getElementById('__app_css');
      if(s){
        s.textContent = ev.data.css;
        try{ parent.postMessage({type:'__oc_console',level:'info',message:'[HMR] ✨ CSS updated',ts:Date.now()},'*') }catch(e){}
      }
    }
  });
})();
</script>`

/** Remove loading overlay helper */
const REMOVE_LOADER = `var __pld=document.getElementById('__pld');if(__pld){__pld.style.opacity='0';setTimeout(function(){__pld.remove()},300)}`

// ─── Phase 6: Asset Pipeline ─────────────────────────────────────────────────

/** Context passed to framework builders for asset resolution */
export interface AssetContext {
  /** Map of file path (e.g. "images/hero.png") → external URL (CDN or data URI) */
  images: Map<string, string>
  /** Map of mock API endpoint path → JSON string response body */
  mockEndpoints: Map<string, string>
  /** SVG files inlined as data URIs: path → data:image/svg+xml;... */
  svgDataUris: Map<string, string>
}

/** Known icon library CDN mappings — auto-detected from imports/deps */
const ICON_LIBRARY_CDNS: Record<string, { css?: string; js?: string }> = {
  'lucide-react': { js: 'https://unpkg.com/lucide@latest/dist/umd/lucide.min.js' },
  'lucide': { js: 'https://unpkg.com/lucide@latest/dist/umd/lucide.min.js' },
  '@fortawesome/fontawesome-free': {
    css: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css',
  },
  'font-awesome': {
    css: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css',
  },
  '@heroicons/react': { /* no CDN — handled via esm.sh import map */ },
  '@mui/icons-material': { /* handled via esm.sh */ },
  'react-icons': { /* handled via esm.sh */ },
  'bootstrap-icons': {
    css: 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css',
  },
  'material-icons': {
    css: 'https://fonts.googleapis.com/icon?family=Material+Icons|Material+Icons+Outlined|Material+Icons+Round',
  },
  'ionicons': {
    js: 'https://unpkg.com/ionicons@7/dist/ionicons/ionicons.esm.js',
  },
  'phosphor-react': { /* handled via esm.sh */ },
  'tabler-icons-react': { /* handled via esm.sh */ },
}

/** Detect icon libraries from deps and code content, return CDN link tags */
function detectIconCDNs(deps: Record<string, string>, codeContent: string): string {
  const links: string[] = []
  const seen = new Set<string>()

  for (const [lib, cdn] of Object.entries(ICON_LIBRARY_CDNS)) {
    if (deps[lib] || codeContent.includes(lib)) {
      if (cdn.css && !seen.has(cdn.css)) {
        links.push(`<link rel="stylesheet" href="${cdn.css}">`)
        seen.add(cdn.css)
      }
      if (cdn.js && !seen.has(cdn.js)) {
        links.push(`<script src="${cdn.js}"><\/script>`)
        seen.add(cdn.js)
      }
    }
  }

  // Detect Font Awesome from class usage (fa-xxx, fas, far, fab, fa-solid, etc.)
  if (!seen.has('font-awesome') && /\bfa[srbl]?\s|fa-[\w-]+|class="[^"]*\bfa\b/.test(codeContent)) {
    const faUrl = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css'
    if (!seen.has(faUrl)) {
      links.push(`<link rel="stylesheet" href="${faUrl}">`)
      seen.add(faUrl)
    }
  }

  // Detect Material Icons from class usage
  if (/class="[^"]*material-icons/.test(codeContent)) {
    const miUrl = 'https://fonts.googleapis.com/icon?family=Material+Icons|Material+Icons+Outlined|Material+Icons+Round'
    if (!seen.has(miUrl)) {
      links.push(`<link rel="stylesheet" href="${miUrl}">`)
      seen.add(miUrl)
    }
  }

  // Detect Bootstrap Icons from class usage (bi bi-xxx)
  if (/\bbi\s+bi-/.test(codeContent)) {
    const biUrl = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css'
    if (!seen.has(biUrl)) {
      links.push(`<link rel="stylesheet" href="${biUrl}">`)
      seen.add(biUrl)
    }
  }

  return links.join('\n')
}

/** Detect Google Fonts from code/CSS content (font-family references) */
function detectGoogleFonts(codeContent: string, existingFontLinks: string[]): string[] {
  const existingSet = new Set(existingFontLinks)
  const newLinks: string[] = []

  // Match font-family declarations in CSS/inline styles
  const fontFamilyRe = /font-family\s*:\s*['"]?([A-Z][A-Za-z\s]+?)['"]?\s*[,;}/]/g
  const systemFonts = new Set([
    'Inter', 'Arial', 'Helvetica', 'Georgia', 'Times', 'Courier', 'Verdana',
    'system-ui', 'sans-serif', 'serif', 'monospace', 'cursive', 'fantasy',
    'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu',
    'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
  ])

  let m
  while ((m = fontFamilyRe.exec(codeContent)) !== null) {
    const family = m[1].trim()
    if (family && !systemFonts.has(family) && family.length < 40) {
      const encoded = family.replace(/\s+/g, '+')
      const url = `https://fonts.googleapis.com/css2?family=${encoded}:wght@300;400;500;600;700&display=swap`
      if (!existingSet.has(url)) {
        newLinks.push(url)
        existingSet.add(url)
      }
    }
  }

  // Match tailwind font classes: font-[family_name]
  const twFontRe = /font-\[['"]?([A-Z][A-Za-z_\s]+?)['"]?\]/g
  while ((m = twFontRe.exec(codeContent)) !== null) {
    const family = m[1].replace(/_/g, ' ').trim()
    if (family && !systemFonts.has(family) && family.length < 40) {
      const encoded = family.replace(/\s+/g, '+')
      const url = `https://fonts.googleapis.com/css2?family=${encoded}:wght@300;400;500;600;700&display=swap`
      if (!existingSet.has(url)) {
        newLinks.push(url)
        existingSet.add(url)
      }
    }
  }

  return newLinks
}

/** Build SVG data URIs from SVG files in the project */
function buildSvgDataUris(files: FileEntry[]): Map<string, string> {
  const svgMap = new Map<string, string>()
  for (const f of files) {
    if (/\.svg$/i.test(f.path)) {
      const encoded = f.content
        .replace(/\n/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      svgMap.set(f.path, `data:image/svg+xml,${encodeURIComponent(encoded)}`)
    }
  }
  return svgMap
}

/** Build mock endpoints from JSON files in the project */
function buildMockEndpoints(files: FileEntry[]): Map<string, string> {
  const endpoints = new Map<string, string>()
  for (const f of files) {
    if (/\.json$/i.test(f.path) && !f.path.endsWith('package.json') && !f.path.endsWith('tsconfig.json')) {
      const content = f.content
      // Create /api/<basename> endpoint: data/users.json → /api/users
      const baseName = f.path
        .replace(/^.*?\/?(data|api|mock|mocks|public|src|assets)\//i, '')
        .replace(/\.json$/i, '')
      endpoints.set(`/api/${baseName}`, content)

      // Register ALL subpath variants so "focusflow/data/x.json" matches "data/x.json"
      const noSlash = f.path.replace(/^\/+/, '')
      endpoints.set(noSlash, content)
      endpoints.set('/' + noSlash, content)
      const parts = noSlash.split('/')
      for (let i = 1; i < parts.length; i++) {
        const sub = parts.slice(i).join('/')
        if (sub && !endpoints.has(sub)) endpoints.set(sub, content)
        if (!endpoints.has('./' + sub)) endpoints.set('./' + sub, content)
        if (!endpoints.has('/' + sub)) endpoints.set('/' + sub, content)
      }
      // Filename only
      const fileName = parts[parts.length - 1]
      if (fileName && !endpoints.has(fileName)) endpoints.set(fileName, content)
    }
  }
  return endpoints
}

/** Helper: register subpath variants for an asset path so "./assets/hero.png" matches "proj/assets/hero.png" */
function registerPathVariants(map: Record<string, string>, origPath: string, value: string) {
  const noSlash = origPath.replace(/^\/+/, '')
  const withSlash = '/' + noSlash
  map[origPath] = value
  map[noSlash] = value
  map[withSlash] = value
  // Filename only
  const fileName = origPath.split('/').pop() || ''
  if (fileName && !map[fileName]) map[fileName] = value
  // Subpath variants: "proj/assets/hero.png" → "assets/hero.png", "./assets/hero.png"
  const parts = noSlash.split('/')
  for (let i = 1; i < parts.length; i++) {
    const sub = parts.slice(i).join('/')
    if (sub && !map[sub]) map[sub] = value
    const dotSub = './' + sub
    if (!map[dotSub]) map[dotSub] = value
    const slashSub = '/' + sub
    if (!map[slashSub]) map[slashSub] = value
  }
}

/**
 * Build the EARLY asset script (injected in <head>, before user code):
 * - Fetch/XHR mock interceptor so all fetch() calls hit mock data
 */
function buildAssetPreScript(assets: AssetContext): string {
  if (assets.mockEndpoints.size === 0) return ''

  const mockMapEntries: string[] = []
  for (const [endpoint, jsonStr] of assets.mockEndpoints) {
    const safeJson = jsonStr.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')
    mockMapEntries.push(`'${endpoint}': '${safeJson}'`)
  }

  return `<script>
(function(){
  // ── Phase 6: Mock API Interceptor (runs before user code) ──
  var __mockMap = {${mockMapEntries.join(',\n')}};

  if(Object.keys(__mockMap).length > 0){
    var _origFetch = window.fetch;
    window.fetch = function(input, init){
      var url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
      var path = url.replace(/^https?:\\/\\/[^/]+/, '').split('?')[0];
      var mockData = __mockMap[path] || __mockMap[path.replace(/^\\//, '')];
      if(mockData){
        try{
          var parsed = JSON.parse(mockData);
          return Promise.resolve(new Response(JSON.stringify(parsed), {
            status: 200, headers: { 'Content-Type': 'application/json' }
          }));
        }catch(e){
          return Promise.resolve(new Response(mockData, {
            status: 200, headers: { 'Content-Type': 'application/json' }
          }));
        }
      }
      return _origFetch.apply(window, arguments);
    };
    var _XHR = window.XMLHttpRequest;
    var OrigXHR = _XHR;
    window.XMLHttpRequest = function(){
      var xhr = new OrigXHR();
      var _open = xhr.open;
      var _mockPath = null;
      xhr.open = function(method, url){
        var path = url.replace(/^https?:\\/\\/[^/]+/, '').split('?')[0];
        var mockData = __mockMap[path] || __mockMap[path.replace(/^\\//, '')];
        if(mockData) _mockPath = mockData;
        else _mockPath = null;
        return _open.apply(xhr, arguments);
      };
      var _send = xhr.send;
      xhr.send = function(){
        if(_mockPath !== null){
          Object.defineProperty(xhr, 'readyState', { get: function(){ return 4; } });
          Object.defineProperty(xhr, 'status', { get: function(){ return 200; } });
          Object.defineProperty(xhr, 'responseText', { get: function(){ return _mockPath; } });
          Object.defineProperty(xhr, 'response', { get: function(){ return _mockPath; } });
          setTimeout(function(){
            if(typeof xhr.onload === 'function') xhr.onload(new Event('load'));
            xhr.dispatchEvent(new Event('load'));
            if(typeof xhr.onreadystatechange === 'function') xhr.onreadystatechange(new Event('readystatechange'));
          }, 10);
          return;
        }
        return _send.apply(xhr, arguments);
      };
      return xhr;
    };
    window.XMLHttpRequest.prototype = OrigXHR.prototype;
  }
})();
<\/script>`
}

/**
 * Build the LATE asset script (injected after user code):
 * - Image URL rewriter (MutationObserver + DOMContentLoaded)
 * - SVG data URI replacement
 */
function buildAssetPostScript(assets: AssetContext): string {
  if (assets.images.size === 0 && assets.svgDataUris.size === 0) return ''

  const imageMapJson: Record<string, string> = {}
  for (const [path, url] of assets.images) registerPathVariants(imageMapJson, path, url)
  for (const [path, dataUri] of assets.svgDataUris) registerPathVariants(imageMapJson, path, dataUri)

  return `<script>
(function(){
  // ── Phase 6: Image URL Rewriter ──
  var __assetMap = ${JSON.stringify(imageMapJson)};

  function rewriteImageUrls(){
    document.querySelectorAll('img[src]').forEach(function(img){
      var src = img.getAttribute('src') || '';
      var resolved = __assetMap[src] || __assetMap[src.replace(/^\\.\\//,'')] || __assetMap[src.split('/').pop()];
      if(resolved){ img.src = resolved; }
    });
    document.querySelectorAll('[style*="background"]').forEach(function(el){
      var style = el.getAttribute('style') || '';
      var updated = style.replace(/url\\(['"]?([^'"\\)]+)['"]?\\)/g, function(m,u){
        var resolved = __assetMap[u] || __assetMap[u.replace(/^\\.\\//,'')] || __assetMap[u.split('/').pop()];
        return resolved ? 'url('+resolved+')' : m;
      });
      if(updated !== style) el.setAttribute('style', updated);
    });
    document.querySelectorAll('source[srcset]').forEach(function(s){
      var srcset = s.getAttribute('srcset') || '';
      var resolved = __assetMap[srcset] || __assetMap[srcset.split('/').pop()];
      if(resolved) s.setAttribute('srcset', resolved);
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){
      rewriteImageUrls();
      setTimeout(rewriteImageUrls, 500);
      setTimeout(rewriteImageUrls, 2000);
    });
  } else {
    rewriteImageUrls();
    setTimeout(rewriteImageUrls, 500);
    setTimeout(rewriteImageUrls, 2000);
  }

  var obs = new MutationObserver(function(mutations){
    var hasNew = false;
    mutations.forEach(function(m){
      if(m.addedNodes.length > 0) hasNew = true;
      if(m.type === 'attributes' && (m.attributeName === 'src' || m.attributeName === 'style')) hasNew = true;
    });
    if(hasNew) rewriteImageUrls();
  });
  obs.observe(document.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:['src','style','srcset'] });
})();
<\/script>`
}

/** Rewrite image paths in code/CSS strings before they're injected into the HTML template */
function rewriteCodeImagePaths(code: string, assets: AssetContext): string {
  if (assets.images.size === 0 && assets.svgDataUris.size === 0) return code

  // Build combined map with all subpath variants
  const flatMap: Record<string, string> = {}
  for (const [p, u] of assets.images) registerPathVariants(flatMap, p, u)
  for (const [p, u] of assets.svgDataUris) registerPathVariants(flatMap, p, u)

  // Collect unique path → url pairs (deduplicate by value)
  const seen = new Set<string>()
  const pairs: [string, string][] = []
  for (const [path, url] of Object.entries(flatMap)) {
    const key = path + '|' + url
    if (!seen.has(key)) { seen.add(key); pairs.push([path, url]) }
  }

  // Sort by path length descending so longer paths match first
  pairs.sort((a, b) => b[0].length - a[0].length)

  // Replace string literals containing image paths
  let result = code
  for (const [path, url] of pairs) {
    const noSlash = path.replace(/^\/+/, '')
    if (!noSlash) continue
    const escaped = noSlash.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`(['"\`])(?:\\.?\\/)?${escaped}\\1`, 'g')
    result = result.replace(re, `$1${url}$1`)
  }
  return result
}

/** Build npm import map for deps (skipping build-only packages) */
function buildNpmImportMap(deps: Record<string, string>, extra?: Record<string, string>): Record<string, string> {
  const importMap: Record<string, string> = extra ? { ...extra } : {}
  for (const [name, ver] of Object.entries(deps)) {
    if (BUILD_ONLY.has(name) || name.startsWith('@types/') || importMap[name]) continue
    const cleanVer = (ver as string).replace(/^[\^~>=<]+/, '')
    importMap[name] = `https://esm.sh/${name}@${cleanVer}`
  }
  return importMap
}

// ─── Main Entry ──────────────────────────────────────────────────────────────

export type DetectedFramework = 'react' | 'vue' | 'svelte' | 'vanilla'

export interface FrameworkPreviewResult {
  html: string
  hasRouter: boolean
  framework: DetectedFramework
  /** Phase 4: HMR payload for incremental updates */
  hmr: {
    css: string
    code: string        // Flattened code without imports/createRoot — for Babel.transform in iframe
    globals: string     // var declarations from __ocModules
    rootComponent: string
  }
}

/** Detect framework from files + deps */
function detectFramework(deps: Record<string, string>, files: FileEntry[]): DetectedFramework | null {
  if (deps['react'] || deps['react-dom']) return 'react'
  // Detect React from .tsx/.jsx files even without package.json
  if (files.some(f => /\.(tsx|jsx)$/i.test(f.path) && !SKIP_FILE.test(f.path))) return 'react'
  if (deps['vue'] || deps['@vue/compiler-sfc'] || files.some(f => /\.vue$/i.test(f.path))) return 'vue'
  if (deps['svelte'] || deps['@sveltejs/kit'] || files.some(f => /\.svelte$/i.test(f.path))) return 'svelte'
  // Vanilla: has JS/TS code files (not just config)
  const hasCode = files.some(f => /\.(js|ts|mjs)$/i.test(f.path) && !SKIP_FILE.test(f.path))
  if (hasCode) return 'vanilla'
  return null
}

export function buildFrameworkPreview(
  fileMap: Map<string, { path: string; content: string }>,
  externalImages?: Map<string, string>,
): FrameworkPreviewResult | null {
  const files = Array.from(fileMap.values())
  if (files.length === 0) return null

  // Parse package.json
  const pkgFile = files.find((f) => f.path.endsWith('package.json'))
  let deps: Record<string, string> = {}
  if (pkgFile) {
    try {
      const pkg = JSON.parse(pkgFile.content)
      deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }
    } catch { /* ignore */ }
  }

  const fw = detectFramework(deps, files)
  if (!fw) return null

  // Phase 6: Build asset context
  const assets: AssetContext = {
    images: externalImages || new Map(),
    svgDataUris: buildSvgDataUris(files),
    mockEndpoints: buildMockEndpoints(files),
  }

  switch (fw) {
    case 'react':  return buildReactPreview(files, deps, assets)
    case 'vue':    return buildVuePreview(files, deps, assets)
    case 'svelte': return buildSveltePreview(files, deps, assets)
    case 'vanilla': return buildVanillaPreview(files, deps, assets)
    default:       return null
  }
}

// ─── React Builder ───────────────────────────────────────────────────────────

function buildReactPreview(files: FileEntry[], deps: Record<string, string>, assets: AssetContext): FrameworkPreviewResult | null {
  // ── 1. Build import map ──
  const importMap: Record<string, string> = {
    react: `https://esm.sh/react@${REACT_VER}`,
    'react-dom': `https://esm.sh/react-dom@${REACT_VER}`,
    'react-dom/client': `https://esm.sh/react-dom@${REACT_VER}/client`,
    'react/jsx-runtime': `https://esm.sh/react@${REACT_VER}/jsx-runtime`,
    // Next.js stubs for platform-aware code
    ...NEXTJS_STUBS,
    // Platform alias stubs (@/lib/*)
    ...PLATFORM_ALIAS_STUBS,
  }

  for (const [name, ver] of Object.entries(deps)) {
    if (BUILD_ONLY.has(name) || name.startsWith('@types/') || importMap[name]) continue
    const cleanVer = (ver as string).replace(/^[\^~>=<]+/, '')
    importMap[name] = `https://esm.sh/${name}@${cleanVer}`
  }

  const scopes: Record<string, Record<string, string>> = {
    'https://esm.sh/': {
      react: `https://esm.sh/react@${REACT_VER}`,
      'react-dom': `https://esm.sh/react-dom@${REACT_VER}`,
      'react/jsx-runtime': `https://esm.sh/react@${REACT_VER}/jsx-runtime`,
      'react-dom/client': `https://esm.sh/react-dom@${REACT_VER}/client`,
    },
  }

  // ── 2. Process CSS ──
  const cssFiles = files.filter((f) => /\.css$/i.test(f.path) && !SKIP_FILE.test(f.path))
  const { css, fontLinks } = processCSS(cssFiles)

  // ── 3. Process code files ──
  const codeFiles = files.filter(
    (f) => /\.(tsx?|jsx?)$/i.test(f.path) && !SKIP_FILE.test(f.path),
  )
  if (codeFiles.length === 0) return null

  const sorted = [...codeFiles].sort((a, b) => filePriority(a.path) - filePriority(b.path))
  const allNpmImports = new Map<string, ImportInfo>()
  const blocks: string[] = []

  for (const file of sorted) {
    const { code, npmImports } = processCodeFile(file.content)
    for (const [pkg, info] of npmImports) {
      if (!allNpmImports.has(pkg)) allNpmImports.set(pkg, { named: new Set() })
      const existing = allNpmImports.get(pkg)!
      if (info.def && !existing.def) existing.def = info.def
      if (info.star && !existing.star) existing.star = info.star
      info.named.forEach((n) => existing.named.add(n))
    }
    if (code) blocks.push(`// ── ${file.path} ──\n${code}`)
  }

  if (!allNpmImports.has('react')) {
    allNpmImports.set('react', { def: 'React', named: new Set() })
  } else if (!allNpmImports.get('react')!.def) {
    allNpmImports.get('react')!.def = 'React'
  }

  // React Router support (Phase 3)
  const hasReactRouter = !!deps['react-router-dom'] || allNpmImports.has('react-router-dom')
  if (hasReactRouter) {
    const rrVer = deps['react-router-dom']
      ? (deps['react-router-dom'] as string).replace(/^[\^~>=<]+/, '')
      : '6'
    const rrBase = `https://esm.sh/react-router-dom@${rrVer}`
    importMap['react-router-dom'] = rrBase
    scopes['https://esm.sh/']['react-router-dom'] = rrBase

    for (let i = 0; i < blocks.length; i++) {
      blocks[i] = blocks[i]
        .replace(/\bBrowserRouter\b/g, 'HashRouter')
        .replace(/\bMemoryRouter\b/g, 'HashRouter')
    }
    if (allNpmImports.has('react-router-dom')) {
      const rrImports = allNpmImports.get('react-router-dom')!
      rrImports.named.delete('BrowserRouter')
      rrImports.named.delete('MemoryRouter')
      rrImports.named.add('HashRouter')
    } else {
      allNpmImports.set('react-router-dom', { named: new Set(['HashRouter', 'Routes', 'Route']) })
    }
  }

  const importStatements = generateImports(allNpmImports, importMap)

  // Inject cn() polyfill if code uses it (shadcn/tailwind utility)
  const joined = blocks.join('\n\n')
  const needsCn = /\bcn\s*\(/.test(joined) && !/function\s+cn\s*\(/.test(joined)
  const cnPolyfill = needsCn
    ? `// cn() polyfill (shadcn utility — clsx + tailwind-merge lite)\nfunction cn(...inputs) { return inputs.flat(Infinity).filter(Boolean).join(' ').replace(/\\s+/g, ' ').trim(); }\n\n`
    : ''
  const fullCode = cnPolyfill + joined

  const rootIdMatch = fullCode.match(/getElementById\s*\(\s*['"]([\w-]+)['"]\s*\)/)
  const rootId = rootIdMatch ? rootIdMatch[1] : 'root'

  const rootCompMatch = fullCode.match(/\.render\s*\(\s*(?:<(\w+)|React\.createElement\s*\(\s*(\w+))/)
  const rootComponent = rootCompMatch ? (rootCompMatch[1] || rootCompMatch[2] || 'App') : 'App'

  const codeUsesRouter = hasReactRouter && /\b(HashRouter|Routes|Route)\b/.test(fullCode)

  // HMR artifacts (Phase 4)
  const hmrGlobals = generateHMRGlobals(allNpmImports)
  const moduleRegistration = generateModuleRegistration(allNpmImports)

  let hmrCode = fullCode
    .replace(/(?:(?:const|let|var)\s+\w+\s*=\s*)?(?:ReactDOM\.)?createRoot\s*\([^)]*\)\s*(?:;\s*\w+)?\.render\s*\([^)]*\)\s*;?/g, '')
    .replace(/(?:window\.__ocRoot\s*=\s*)?(?:ReactDOM\.)?createRoot\s*\([^)]*\)\s*;?/g, '')
    .replace(/(?:window\.)?__ocRoot\.render\s*\([^)]*\)\s*;?/g, '')
    .trim()
  hmrCode += `\nwindow.__ocApp = typeof ${rootComponent} !== 'undefined' ? ${rootComponent} : window.__ocApp;`

  let patchedFullCode = importStatements + ';\n\n' + fullCode
  patchedFullCode = patchedFullCode.replace(
    /((?:ReactDOM\.)?createRoot\s*\(\s*document\.getElementById\s*\(\s*['"][^'"]+['"]\s*\)\s*!?\s*\))\s*\.render\s*\(/,
    'window.__ocRoot = $1;\nwindow.__ocRoot.render(',
  )
  patchedFullCode += '\n\n// HMR module cache (Phase 4)\n' + moduleRegistration
  patchedFullCode += `\nwindow.__ocApp = typeof ${rootComponent} !== 'undefined' ? ${rootComponent} : null;`

  // Phase 6: Rewrite image paths in code + collect all code for asset detection
  const allCodeContent = patchedFullCode + '\n' + css
  patchedFullCode = rewriteCodeImagePaths(patchedFullCode, assets)
  const safeCode = patchedFullCode.replace(/<\/script/gi, '<\\/script')
  const uniqueFonts = [...new Set(fontLinks)]

  // Phase 6: Icon CDNs + extra Google Fonts
  const iconCdnLinks = detectIconCDNs(deps, allCodeContent)
  const extraFontLinks = detectGoogleFonts(allCodeContent, uniqueFonts)
  const allFontLinks = [...uniqueFonts, ...extraFontLinks]
  const mockScript = buildAssetPreScript(assets)
  const imageScript = buildAssetPostScript(assets)

  return { html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Preview</title>
${allFontLinks.map((url) => `<link rel="stylesheet" href="${url}">`).join('\n')}
${iconCdnLinks}
<script src="https://cdn.tailwindcss.com"><\/script>
<script>tailwind.config={darkMode:'class',theme:{extend:{}}}<\/script>
${mockScript}
<script type="importmap">
${JSON.stringify({ imports: importMap, scopes }, null, 2)}
<\/script>
<style id="__app_css">
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',system-ui,-apple-system,BlinkMacSystemFont,sans-serif}
${css}
</style>
</head>
<body class="antialiased">
<div id="${rootId}"></div>
${loadingOverlay('Transpiling JSX…')}
<script src="https://unpkg.com/@babel/standalone@7/babel.min.js"><\/script>
<script type="text/babel" data-type="module" data-presets="react,typescript">
${safeCode}
const __pld = document.getElementById('__pld');
if (__pld) { __pld.style.opacity = '0'; setTimeout(() => __pld.remove(), 300); }
<\/script>
${CONSOLE_CAPTURE_SCRIPT}
${imageScript}
<script>
// ── React HMR Handler (Phase 4) ─────────────────────────────────────
(function(){
  window.addEventListener('message', function(ev){
    if(!ev.data || ev.data.type !== '__oc_hot_update') return;
    if(ev.data.kind === 'css'){
      var s = document.getElementById('__app_css');
      if(s){
        s.textContent = ev.data.css;
        try{ parent.postMessage({type:'__oc_console',level:'info',message:'[HMR] ✨ CSS updated',ts:Date.now()},'*') }catch(e){}
      }
      return;
    }
    if(ev.data.kind === 'js'){
      try{
        var fullSrc = (ev.data.globals||'') + '\\n' + (ev.data.code||'');
        var transformed = Babel.transform(fullSrc, {
          presets: ['react', ['typescript', {allExtensions:true, isTSX:true}]],
          filename: 'hmr-update.tsx'
        });
        var script = document.createElement('script');
        script.textContent = transformed.code;
        document.head.appendChild(script);
        document.head.removeChild(script);
        if(window.__ocRoot && window.__ocApp){
          var React = window.__ocModules && window.__ocModules['react'] ? window.__ocModules['react'] : null;
          var ce = React ? (React.createElement || React['default'] && React['default'].createElement) : null;
          if(ce){
            window.__ocRoot.render(ce(window.__ocApp));
            try{ parent.postMessage({type:'__oc_console',level:'info',message:'[HMR] ⚡ Module updated — React state preserved',ts:Date.now()},'*') }catch(e){}
          }
        }
      }catch(err){
        try{ parent.postMessage({type:'__oc_console',level:'error',message:'[HMR] Hot update failed: '+(err.message||err),ts:Date.now()},'*') }catch(e){}
      }
      return;
    }
  });
})();
<\/script>
${codeUsesRouter ? `<script>
(function(){
  var lastHash='';
  function reportRoute(){
    var h=location.hash||'#/';
    var path=h.replace(/^#/,'')||'/';
    if(path!==lastHash){lastHash=path;try{parent.postMessage({type:'__oc_route',path:path},'*')}catch(e){}}
  }
  window.addEventListener('hashchange',reportRoute);
  var polls=0;
  var iv=setInterval(function(){reportRoute();if(++polls>10)clearInterval(iv)},200);
  window.addEventListener('message',function(ev){
    if(ev.data&&ev.data.type==='__oc_navigate'){location.hash='#'+(ev.data.path||'/')}
  });
})();
<\/script>` : ''}
</body>
</html>`, hasRouter: codeUsesRouter, framework: 'react', hmr: { css, code: hmrCode, globals: hmrGlobals, rootComponent } }
}

// ─── Vue 3 Builder ───────────────────────────────────────────────────────────

/** Parse a .vue SFC into template, script, style sections */
function parseVueSFC(content: string): { template: string; script: string; style: string; scriptSetup: boolean } {
  const templateM = content.match(/<template[^>]*>([\s\S]*?)<\/template>/i)
  const scriptM = content.match(/<script(\s+setup)?[^>]*>([\s\S]*?)<\/script>/i)
  const styleM = content.match(/<style[^>]*>([\s\S]*?)<\/style>/i)
  return {
    template: templateM ? templateM[1].trim() : '<div></div>',
    script: scriptM ? scriptM[2].trim() : '',
    scriptSetup: !!scriptM?.[1],
    style: styleM ? styleM[1].trim() : '',
  }
}

function buildVuePreview(files: FileEntry[], deps: Record<string, string>, assets: AssetContext): FrameworkPreviewResult | null {
  // CSS
  const cssFiles = files.filter(f => /\.css$/i.test(f.path) && !SKIP_FILE.test(f.path))
  const { css, fontLinks } = processCSS(cssFiles)

  // .vue files
  const vueFiles = files.filter(f => /\.vue$/i.test(f.path))
  // JS/TS code files (non-vue)
  const jsFiles = files.filter(f => /\.(tsx?|jsx?|mjs)$/i.test(f.path) && !SKIP_FILE.test(f.path))

  if (vueFiles.length === 0 && jsFiles.length === 0) return null

  // Vue version
  const vueVer = deps['vue'] ? (deps['vue'] as string).replace(/^[\^~>=<]+/, '') : '3.5.13'

  // Parse SFCs and extract styles
  let sfcStyles = ''
  const componentDefs: string[] = []
  let rootComponentName = 'App'

  for (const vf of vueFiles) {
    const sfc = parseVueSFC(vf.content)
    const name = vf.path.split('/').pop()?.replace(/\.vue$/i, '') || 'Component'
    const compName = name.charAt(0).toUpperCase() + name.slice(1)

    if (/App/i.test(name)) rootComponentName = compName

    if (sfc.style) sfcStyles += `/* ${vf.path} */\n${sfc.style}\n\n`

    // Escape backticks and ${} in template for template literal
    const safeTemplate = sfc.template.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')

    // Process script: strip import/export, extract content
    let scriptBody = sfc.script
    // Remove import lines (Vue imports handled globally)
    scriptBody = scriptBody.replace(/^import\s+.+?from\s+['"][^'"]+['"];?\s*$/gm, '')
    // Strip export default
    scriptBody = scriptBody.replace(/^export\s+default\s*\{/m, '{')
    scriptBody = scriptBody.replace(/^export\s+default\s+/gm, '')

    if (sfc.scriptSetup) {
      // <script setup> → wrapped into setup() function
      componentDefs.push(`
const ${compName} = {
  template: \`${safeTemplate}\`,
  setup() {
    ${scriptBody}
    // Auto-return all local const/let/function bindings
    return typeof __setupReturn !== 'undefined' ? __setupReturn : {};
  }
};`)
    } else {
      // Options API: merge template into the object
      const trimmed = scriptBody.trim()
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        // Insert template property into the object literal
        componentDefs.push(`const ${compName} = Object.assign(${trimmed}, { template: \`${safeTemplate}\` });`)
      } else {
        componentDefs.push(`
const ${compName} = {
  template: \`${safeTemplate}\`,
  ${scriptBody}
};`)
      }
    }
  }

  // Process plain JS files (utilities, stores)
  const jsBlocks: string[] = []
  for (const f of jsFiles) {
    const { code } = processCodeFile(f.content)
    if (code.trim()) jsBlocks.push(`// ── ${f.path} ──\n${code}`)
  }

  // Build import map for extra npm deps
  const importMap = buildNpmImportMap(deps, {
    vue: `https://esm.sh/vue@${vueVer}`,
  })
  // Remove vue from BUILD_ONLY exclusion
  delete importMap['@vue/compiler-sfc']

  // Detect vue-router
  const hasVueRouter = !!deps['vue-router'] || jsBlocks.some(b => /vue-router/i.test(b))

  // Build the full Vue app code
  const allCSS = css + sfcStyles
  const safeAllCSS = allCSS.replace(/<\/style/gi, '<\\/style')
  const uniqueFonts = [...new Set(fontLinks)]

  // Phase 6: Asset pipeline for Vue
  const allCodeContent = jsBlocks.join('\n') + '\n' + componentDefs.join('\n') + '\n' + allCSS
  const iconCdnLinks = detectIconCDNs(deps, allCodeContent)
  const extraFontLinks = detectGoogleFonts(allCodeContent, uniqueFonts)
  const allFontLinks = [...uniqueFonts, ...extraFontLinks]
  const mockScript = buildAssetPreScript(assets)
  const imageScript = buildAssetPostScript(assets)

  let appCodeRaw = `
import { createApp, ref, reactive, computed, watch, watchEffect, onMounted, onUnmounted, nextTick, defineComponent, h, toRef, toRefs, provide, inject } from 'vue';
${hasVueRouter ? "import { createRouter, createWebHashHistory, RouterView, RouterLink } from 'vue-router';" : ''}

${jsBlocks.join('\n\n')}

${componentDefs.join('\n\n')}

// Mount
const app = createApp(${rootComponentName});
${hasVueRouter ? `
const router = createRouter({
  history: createWebHashHistory(),
  routes: typeof routes !== 'undefined' ? routes : [{ path: '/', component: ${rootComponentName} }]
});
app.use(router);
` : ''}
app.mount('#app');
window.__ocVueApp = app;
${REMOVE_LOADER}
`.trim()
  appCodeRaw = rewriteCodeImagePaths(appCodeRaw, assets)
  const appCode = appCodeRaw.replace(/<\/script/gi, '<\\/script')

  return { html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Preview</title>
${allFontLinks.map(url => `<link rel="stylesheet" href="${url}">`).join('\n')}
${iconCdnLinks}
<script src="https://cdn.tailwindcss.com"><\/script>
<script>tailwind.config={darkMode:'class',theme:{extend:{}}}<\/script>
${mockScript}
<script type="importmap">
${JSON.stringify({ imports: importMap }, null, 2)}
<\/script>
<style id="__app_css">
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',system-ui,-apple-system,BlinkMacSystemFont,sans-serif}
${safeAllCSS}
</style>
</head>
<body class="antialiased">
<div id="app"></div>
${loadingOverlay('Compiling Vue SFC…')}
<script type="module">
${appCode}
<\/script>
${CONSOLE_CAPTURE_SCRIPT}
${imageScript}
${CSS_HMR_SCRIPT}
${hasVueRouter ? `<script>
(function(){
  var lastHash='';
  function reportRoute(){
    var h=location.hash||'#/';
    var path=h.replace(/^#/,'')||'/';
    if(path!==lastHash){lastHash=path;try{parent.postMessage({type:'__oc_route',path:path},'*')}catch(e){}}
  }
  window.addEventListener('hashchange',reportRoute);
  var polls=0;
  var iv=setInterval(function(){reportRoute();if(++polls>10)clearInterval(iv)},200);
  window.addEventListener('message',function(ev){
    if(ev.data&&ev.data.type==='__oc_navigate'){location.hash='#'+(ev.data.path||'/')}
  });
})();
<\/script>` : ''}
</body>
</html>`, hasRouter: hasVueRouter, framework: 'vue', hmr: { css: allCSS, code: '', globals: '', rootComponent: rootComponentName } }
}

// ─── Svelte Builder ──────────────────────────────────────────────────────────

/** Parse a .svelte component into script, style, template (markup) */
function parseSvelteComponent(content: string): { script: string; style: string; markup: string } {
  let markup = content
  let script = ''
  let style = ''

  const scriptM = content.match(/<script[^>]*>([\s\S]*?)<\/script>/i)
  if (scriptM) {
    script = scriptM[1].trim()
    markup = markup.replace(scriptM[0], '')
  }

  const styleM = content.match(/<style[^>]*>([\s\S]*?)<\/style>/i)
  if (styleM) {
    style = styleM[1].trim()
    markup = markup.replace(styleM[0], '')
  }

  return { script, style, markup: markup.trim() }
}

function buildSveltePreview(files: FileEntry[], deps: Record<string, string>, assets: AssetContext): FrameworkPreviewResult | null {
  // CSS
  const cssFiles = files.filter(f => /\.css$/i.test(f.path) && !SKIP_FILE.test(f.path))
  const { css, fontLinks } = processCSS(cssFiles)

  // .svelte files
  const svelteFiles = files.filter(f => /\.svelte$/i.test(f.path))
  // JS/TS helper files
  const jsFiles = files.filter(f => /\.(tsx?|jsx?|mjs)$/i.test(f.path) && !SKIP_FILE.test(f.path))

  if (svelteFiles.length === 0 && jsFiles.length === 0) return null

  // Svelte version
  const svelteVer = deps['svelte'] ? (deps['svelte'] as string).replace(/^[\^~>=<]+/, '') : '4.2.19'
  const isSvelte5 = svelteVer.startsWith('5')

  // Parse components and collect styles
  let svelteStyles = ''
  const componentSources: { name: string; source: string }[] = []
  let rootName = 'App'

  for (const sf of svelteFiles) {
    const parsed = parseSvelteComponent(sf.content)
    const name = sf.path.split('/').pop()?.replace(/\.svelte$/i, '') || 'Component'
    if (/App/i.test(name)) rootName = name

    if (parsed.style) svelteStyles += `/* ${sf.path} */\n${parsed.style}\n\n`

    // Store full source for in-browser compilation
    componentSources.push({ name, source: sf.content })
  }

  // JS helpers
  const jsBlocks: string[] = []
  for (const f of jsFiles) {
    const { code } = processCodeFile(f.content)
    if (code.trim()) jsBlocks.push(code)
  }

  const allCSS = css + svelteStyles
  const safeAllCSS = allCSS.replace(/<\/style/gi, '<\\/style')
  const uniqueFonts = [...new Set(fontLinks)]

  // Phase 6: Asset pipeline for Svelte
  const allCodeContent = jsBlocks.join('\n') + '\n' + componentSources.map(c => c.source).join('\n') + '\n' + allCSS
  const iconCdnLinks = detectIconCDNs(deps, allCodeContent)
  const extraFontLinks = detectGoogleFonts(allCodeContent, uniqueFonts)
  const allFontLinks = [...uniqueFonts, ...extraFontLinks]
  const mockScript = buildAssetPreScript(assets)
  const imageScript = buildAssetPostScript(assets)

  // Import map for svelte + npm deps
  const importMap = buildNpmImportMap(deps, {
    svelte: `https://esm.sh/svelte@${svelteVer}`,
    'svelte/internal': `https://esm.sh/svelte@${svelteVer}/internal`,
    'svelte/compiler': `https://esm.sh/svelte@${svelteVer}/compiler`,
    ...(isSvelte5 ? { 'svelte/internal/client': `https://esm.sh/svelte@${svelteVer}/internal/client` } : {}),
  })

  // Serialize component sources as JSON for the in-browser compiler
  // Phase 6: Rewrite image paths in component sources
  const rewrittenSources = componentSources.map(c => ({
    name: c.name,
    source: rewriteCodeImagePaths(c.source, assets),
  }))
  const componentsJson = JSON.stringify(rewrittenSources).replace(/<\/script/gi, '<\\/script')

  let helpersRaw = jsBlocks.join('\n\n')
  helpersRaw = rewriteCodeImagePaths(helpersRaw, assets)
  const helpersCode = helpersRaw.replace(/<\/script/gi, '<\\/script')

  return { html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Preview</title>
${allFontLinks.map(url => `<link rel="stylesheet" href="${url}">`).join('\n')}
${iconCdnLinks}
<script src="https://cdn.tailwindcss.com"><\/script>
<script>tailwind.config={darkMode:'class',theme:{extend:{}}}<\/script>
${mockScript}
<script type="importmap">
${JSON.stringify({ imports: importMap }, null, 2)}
<\/script>
<style id="__app_css">
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',system-ui,-apple-system,BlinkMacSystemFont,sans-serif}
${safeAllCSS}
</style>
</head>
<body class="antialiased">
<div id="app"></div>
${loadingOverlay('Compiling Svelte…')}
<script type="module">
import { compile } from 'svelte/compiler';

// Helpers
${helpersCode}

// Component sources
const __components = ${componentsJson};
const __rootName = '${rootName}';

// Compile each .svelte file
let RootComponent = null;
for (const comp of __components) {
  try {
    const result = compile(comp.source, {
      generate: ${isSvelte5 ? "'client'" : "'dom'"},
      name: comp.name,
      filename: comp.name + '.svelte',
      ${isSvelte5 ? '' : "css: 'injected',"}
      dev: false,
    });

    // Create a module from the compiled code
    const blob = new Blob([result.js.code], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const mod = await import(url);
    URL.revokeObjectURL(url);

    // Register globally
    window['__svelte_' + comp.name] = mod.default || mod;

    if (comp.name === __rootName) {
      RootComponent = mod.default || mod;
    }
  } catch(err) {
    console.error('[Svelte] Compilation failed for ' + comp.name + ':', err);
  }
}

// Mount root component
if (RootComponent) {
  const target = document.getElementById('app');
  ${isSvelte5
    ? `import { mount } from 'svelte';
  window.__ocSvelteApp = mount(RootComponent, { target });`
    : `window.__ocSvelteApp = new RootComponent({ target });`
  }
}

${REMOVE_LOADER}
<\/script>
${CONSOLE_CAPTURE_SCRIPT}
${imageScript}
${CSS_HMR_SCRIPT}
</body>
</html>`, hasRouter: false, framework: 'svelte', hmr: { css: allCSS, code: '', globals: '', rootComponent: rootName } }
}

// ─── Vanilla JS Builder ──────────────────────────────────────────────────────

function buildVanillaPreview(files: FileEntry[], deps: Record<string, string>, assets: AssetContext): FrameworkPreviewResult | null {
  // CSS
  const cssFiles = files.filter(f => /\.css$/i.test(f.path) && !SKIP_FILE.test(f.path))
  const { css, fontLinks } = processCSS(cssFiles)

  // HTML entry (if exists)
  const htmlFile = files.find(f => /\.html?$/i.test(f.path))

  // JS/TS code files
  const jsFiles = files.filter(f => /\.(js|ts|mjs)$/i.test(f.path) && !SKIP_FILE.test(f.path))

  if (jsFiles.length === 0 && !htmlFile) return null

  // Sort and process JS files
  const sorted = [...jsFiles].sort((a, b) => filePriority(a.path) - filePriority(b.path))

  const allNpmImports = new Map<string, ImportInfo>()
  const blocks: string[] = []

  for (const f of sorted) {
    const { code, npmImports } = processCodeFile(f.content)
    for (const [pkg, info] of npmImports) {
      if (!allNpmImports.has(pkg)) allNpmImports.set(pkg, { named: new Set() })
      const existing = allNpmImports.get(pkg)!
      if (info.def && !existing.def) existing.def = info.def
      if (info.star && !existing.star) existing.star = info.star
      info.named.forEach(n => existing.named.add(n))
    }
    if (code.trim()) blocks.push(`// ── ${f.path} ──\n${code}`)
  }

  // Build import map
  const importMap = buildNpmImportMap(deps)
  const importStatements = generateImports(allNpmImports, importMap)

  // Phase 6: Asset pipeline for Vanilla
  const fullCode = blocks.join('\n\n')
  const allCodeContent = fullCode + '\n' + css + '\n' + (htmlFile?.content || '')
  const iconCdnLinks = detectIconCDNs(deps, allCodeContent)
  const extraFontLinks = detectGoogleFonts(allCodeContent, [...new Set(fontLinks)])
  const allFontLinks = [...new Set(fontLinks), ...extraFontLinks]
  const mockScript = buildAssetPreScript(assets)
  const imageScript = buildAssetPostScript(assets)

  let rewrittenCode = rewriteCodeImagePaths(fullCode, assets)
  const safeCode = (importStatements ? importStatements + ';\n\n' : '') + rewrittenCode
  const escapedCode = safeCode.replace(/<\/script/gi, '<\\/script')

  const allCSS = css
  const uniqueFonts = allFontLinks

  // ── Extract CDN scripts & stylesheets from Claude's HTML <head> ──
  // This preserves external libraries (Three.js, Phaser, Babylon, p5, GSAP, etc.)
  // that Claude includes via <script src="..."> or <link rel="stylesheet"> in <head>.
  let userHeadCdnTags = ''
  if (htmlFile) {
    const headM = htmlFile.content.match(/<head[^>]*>([\s\S]*?)<\/head>/i)
    if (headM) {
      const headContent = headM[1]
      const cdnTags: string[] = []
      // Preserve <script src="https://..."> CDN tags (not inline scripts, not tailwind CDN which we inject ourselves)
      const scriptSrcRe = /<script[^>]+src\s*=\s*["']([^"']+)["'][^>]*>[\s\S]*?<\/script>/gi
      let sm: RegExpExecArray | null
      while ((sm = scriptSrcRe.exec(headContent)) !== null) {
        const src = sm[1]
        // Skip Tailwind (we inject it), skip data URIs, skip relative paths
        if (src.includes('tailwindcss') || src.startsWith('data:') || (!src.startsWith('http') && !src.startsWith('//'))) continue
        cdnTags.push(sm[0].replace(/<\/script/gi, '<\\/script'))
      }
      // Preserve <link rel="stylesheet" href="https://..."> CDN links (not Google Fonts, which we detect separately)
      const linkRe = /<link[^>]+rel\s*=\s*["']stylesheet["'][^>]+href\s*=\s*["']([^"']+)["'][^>]*\/?>/gi
      let lm: RegExpExecArray | null
      while ((lm = linkRe.exec(headContent)) !== null) {
        const href = lm[1]
        if (href.includes('fonts.googleapis.com')) continue // Already handled by detectGoogleFonts
        if (href.startsWith('http') || href.startsWith('//')) {
          cdnTags.push(lm[0])
        }
      }
      // Also preserve <script type="module"> with CDN imports in the head (e.g. Three.js ES module pattern)
      const moduleScriptRe = /<script[^>]+type\s*=\s*["']module["'][^>]*>([\s\S]*?)<\/script>/gi
      let msm: RegExpExecArray | null
      while ((msm = moduleScriptRe.exec(headContent)) !== null) {
        // Only keep if it contains a CDN import (http/https)
        if (/from\s+["']https?:\/\//.test(msm[1]) || /import\s+["']https?:\/\//.test(msm[1])) {
          cdnTags.push(msm[0].replace(/<\/script/gi, '<\\/script'))
        }
      }
      userHeadCdnTags = cdnTags.join('\n')
    }
  }

  // If there's an HTML file, extract its body and merge
  let bodyContent = '<div id="app"></div>'
  const hasExternalJsFiles = jsFiles.length > 0
  if (htmlFile) {
    const bodyM = htmlFile.content.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    if (bodyM) {
      bodyContent = bodyM[1].trim()
      // Strip/preserve inline <script> tags from body based on context
      // Always PRESERVE <script src="https://..."> CDN tags in body
      const bodyCdnScripts: string[] = []
      const bodyInlineScripts: string[] = []
      bodyContent = bodyContent.replace(/<script[\s\S]*?<\/script>/gi, (match) => {
        const srcMatch = match.match(/src\s*=\s*["']([^"']+)["']/)
        if (srcMatch && (srcMatch[1].startsWith('http') || srcMatch[1].startsWith('//'))) {
          // CDN script in body — always preserve
          bodyCdnScripts.push(match.replace(/<\/script/gi, '<\\/script'))
          return ''
        }
        if (srcMatch && !srcMatch[1].startsWith('http')) {
          // Local src script (e.g. src="script.js") — strip, already processed in blocks
          return ''
        }
        // Inline script (no src attribute) — preserve for single-file HTML, strip when JS files exist
        if (!hasExternalJsFiles) {
          bodyInlineScripts.push(match.replace(/<\/script/gi, '<\\/script'))
        }
        return '' // Remove from original position in all cases
      })
      // Re-add preserved scripts
      if (bodyCdnScripts.length > 0) {
        bodyContent = bodyCdnScripts.join('\n') + '\n' + bodyContent
      }
      if (bodyInlineScripts.length > 0) {
        bodyContent = bodyContent + '\n' + bodyInlineScripts.join('\n')
      }
    } else if (!htmlFile.content.includes('<html')) {
      // It's a fragment, use as-is
      bodyContent = htmlFile.content
    }
  }
  // Phase 6: Rewrite image paths in HTML body
  bodyContent = rewriteCodeImagePaths(bodyContent, assets)

  const hasModule = allNpmImports.size > 0
  const safeBodyContent = bodyContent.replace(/<\/script/gi, '<\\/script')

  return { html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Preview</title>
${uniqueFonts.map(url => `<link rel="stylesheet" href="${url}">`).join('\n')}
${iconCdnLinks}
${userHeadCdnTags}
<script src="https://cdn.tailwindcss.com"><\/script>
<script>tailwind.config={darkMode:'class',theme:{extend:{}}}<\/script>
${mockScript}
${hasModule ? `<script type="importmap">
${JSON.stringify({ imports: importMap }, null, 2)}
<\/script>` : ''}
<style id="__app_css">
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',system-ui,-apple-system,BlinkMacSystemFont,sans-serif}
${allCSS}
</style>
</head>
<body class="antialiased">
${safeBodyContent}
${loadingOverlay('Loading…')}
<script ${hasModule ? 'type="module"' : ''}>
${escapedCode}
${REMOVE_LOADER}
<\/script>
${CONSOLE_CAPTURE_SCRIPT}
${imageScript}
${CSS_HMR_SCRIPT}
</body>
</html>`, hasRouter: false, framework: 'vanilla', hmr: { css: allCSS, code: rewrittenCode, globals: '', rootComponent: '' } }
}
