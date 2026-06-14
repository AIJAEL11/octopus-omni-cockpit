// Tipos para el sistema de Brazos (Connections)

export type ArmType = 'github' | 'gmail' | 'telegram' | 'hostinger' | 'vps' | 'whatsapp' | 'sms' | 'google_workspace' | 'ollama' | 'web3forms' | 'smtp' | 'browser_automation'

// === Browser Automation Types ===
export type BrowserSessionStatus = 'idle' | 'running' | 'paused' | 'error' | 'completed'
export type BrowserCommandType = 'goto' | 'click' | 'type' | 'screenshot' | 'scroll' | 'wait' | 'extract' | 'evaluate' | 'keypress' | 'new_tab' | 'switch_tab' | 'close_tab' | 'list_tabs' | 'start_recording' | 'stop_recording'

export interface BrowserCommand {
  id: string
  type: BrowserCommandType
  params: Record<string, any>
  status: 'pending' | 'sent' | 'completed' | 'failed'
  result?: any
  screenshotUrl?: string
  createdAt: string
  completedAt?: string
}

export interface BrowserSession {
  id: string
  name: string
  status: BrowserSessionStatus
  currentUrl?: string
  lastScreenshot?: string
  commands: BrowserCommand[]
  createdAt: string
  updatedAt: string
}

export type ArmStatus = 'connected' | 'disconnected' | 'pending' | 'error'

// === Ollama Arm Status (auto-detectado por Bridge local) ===
export interface OllamaArmStatus {
  installed: boolean       // ¿Está Ollama instalado en el equipo? (filesystem check)
  running: boolean         // ¿Está el servicio Ollama corriendo? (HTTP probe)
  version?: string         // Versión de Ollama (si responde el HTTP)
  models: OllamaModel[]    // Lista de modelos descargados
  detectionMethod: 'http' | 'filesystem' | 'process' | 'none'
  lastSeenAt?: string      // ISO timestamp del último report del Bridge
  bridgePresent: boolean   // ¿El Bridge local está reportando?
  os?: 'mac' | 'windows' | 'linux'
  hardware?: OllamaHardware // Hardware specs detected by Bridge
  pullQueue?: OllamaPullRequest[] // Pending/active model downloads
}

export interface OllamaHardware {
  totalRam?: number        // bytes total RAM
  cpu?: string             // CPU model string
  cpuCores?: number        // number of cores
  gpu?: string             // GPU model string (if detected)
  gpuVram?: number         // bytes GPU VRAM (if detected)
}

export interface OllamaPullRequest {
  id: string               // unique pull ID
  model: string            // model tag to pull e.g. "llama3.2:8b"
  status: 'pending' | 'downloading' | 'completed' | 'failed'
  progress?: number        // 0-100 percentage
  totalSize?: number       // bytes
  downloadedSize?: number  // bytes
  error?: string
  startedAt: string        // ISO timestamp
  completedAt?: string     // ISO timestamp
}

export interface OllamaModel {
  name: string             // ej: "llama3.2:latest"
  size?: number            // bytes
  modifiedAt?: string      // ISO timestamp
  family?: string          // ej: "llama"
  parameterSize?: string   // ej: "8B"
  quantization?: string    // ej: "Q4_K_M"
}

// === Cookbook: Curated Model Catalog ===
export interface CookbookModel {
  id: string               // unique identifier
  name: string             // display name
  ollamaTag: string        // e.g. "llama3.2:8b"
  description: string
  category: 'chat' | 'code' | 'vision' | 'embedding' | 'reasoning'
  family: string           // e.g. "llama", "qwen", "gemma"
  parameterSize: string    // e.g. "8B", "70B"
  minRamGB: number         // minimum RAM in GB to run
  recommendedRamGB: number // recommended RAM for good performance
  diskSizeGB: number       // approximate download size in GB
  quantization: string     // default quantization
  highlights: string[]     // key features
  tier: 'lightweight' | 'standard' | 'heavy' | 'extreme'
}

export interface ArmConnection {
  id: string
  type: ArmType
  status: ArmStatus
  name: string
  description: string
  icon: string
  color: string
  connectedAt?: Date
  metadata?: Record<string, any>
}

export interface ArmConfig {
  type: ArmType
  name: string
  description: string
  descriptionEn?: string
  icon: string
  color: string
  requiredFields: {
    name: string
    label: string
    labelEn?: string
    type: 'text' | 'password' | 'textarea'
    placeholder: string
  }[]
  instructions: string
  instructionsEn?: string
  /** Si es true, el brazo usa OAuth y requiere un flujo de autorización adicional */
  isOAuth?: boolean
  /** Scopes de OAuth necesarios */
  oauthScopes?: string[]
  /** Servicios incluidos en esta conexión */
  services?: { name: string; icon: string; description: string; descriptionEn?: string }[]
  /** Si es true, este brazo se auto-detecta vía Bridge local (no requiere conexión manual) */
  isAutoDetected?: boolean
}

export const ARM_CONFIGS: Record<ArmType, ArmConfig> = {
  github: {
    type: 'github',
    name: 'GitHub',
    description: 'Conecta tu cuenta de GitHub para gestionar repositorios y código',
    descriptionEn: 'Connect your GitHub account to manage repositories and code',
    icon: 'github',
    color: '#24292e',
    requiredFields: [
      { name: 'token', label: 'Personal Access Token', labelEn: 'Personal Access Token', type: 'password', placeholder: 'ghp_xxxxxxxxxxxx' },
      { name: 'username', label: 'Usuario de GitHub', labelEn: 'GitHub Username', type: 'text', placeholder: 'your-username' },
    ],
    instructions: '1. Ve a GitHub > Settings > Developer Settings > Personal Access Tokens\n2. Genera un nuevo token con permisos de repo\n3. Copia y pega el token aquí',
    instructionsEn: '1. Go to GitHub > Settings > Developer Settings > Personal Access Tokens\n2. Generate a new token with repo permissions\n3. Copy and paste the token here',
  },
  gmail: {
    type: 'gmail',
    name: 'Gmail',
    description: 'Conecta Gmail para enviar y recibir correos automáticamente',
    descriptionEn: 'Connect Gmail to send and receive emails automatically',
    icon: 'mail',
    color: '#EA4335',
    requiredFields: [
      { name: 'email', label: 'Correo de Gmail', labelEn: 'Gmail Address', type: 'text', placeholder: 'your-email@gmail.com' },
      { name: 'appPassword', label: 'Contraseña de Aplicación', labelEn: 'App Password', type: 'password', placeholder: 'xxxx xxxx xxxx xxxx' },
    ],
    instructions: '1. Ve a tu cuenta de Google > Seguridad\n2. Activa la verificación en 2 pasos\n3. Genera una contraseña de aplicación\n4. Copia la contraseña de 16 caracteres',
    instructionsEn: '1. Go to your Google account > Security\n2. Enable 2-Step Verification\n3. Generate an App Password\n4. Copy the 16-character password',
  },
  telegram: {
    type: 'telegram',
    name: 'Telegram',
    description: 'Recibe notificaciones y controla Octopus desde Telegram',
    descriptionEn: 'Receive notifications and control Octopus from Telegram',
    icon: 'send',
    color: '#0088cc',
    requiredFields: [
      { name: 'botToken', label: 'Bot Token', labelEn: 'Bot Token', type: 'password', placeholder: '123456789:ABCdefGHIjklMNOpqrsTUVwxyz' },
      { name: 'chatId', label: 'Chat ID', labelEn: 'Chat ID', type: 'text', placeholder: '123456789' },
    ],
    instructions: '1. Habla con @BotFather en Telegram\n2. Crea un nuevo bot con /newbot\n3. Copia el token del bot\n4. Envía un mensaje al bot y usa @userinfobot para obtener tu Chat ID',
    instructionsEn: '1. Talk to @BotFather on Telegram\n2. Create a new bot with /newbot\n3. Copy the bot token\n4. Send a message to the bot and use @userinfobot to get your Chat ID',
  },
  hostinger: {
    type: 'hostinger',
    name: 'Hostinger',
    description: 'Despliega proyectos automáticamente en tu hosting',
    descriptionEn: 'Deploy projects automatically to your hosting',
    icon: 'globe',
    color: '#673DE6',
    requiredFields: [
      { name: 'apiKey', label: 'API Key', labelEn: 'API Key', type: 'password', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
      { name: 'domain', label: 'Dominio', labelEn: 'Domain', type: 'text', placeholder: 'your-domain.com' },
    ],
    instructions: '1. Inicia sesión en Hostinger\n2. Ve a Panel de Control > Integraciones API\n3. Genera una nueva API Key\n4. Copia la clave y tu dominio principal',
    instructionsEn: '1. Log in to Hostinger\n2. Go to Control Panel > API Integrations\n3. Generate a new API Key\n4. Copy the key and your main domain',
  },
  vps: {
    type: 'vps',
    name: 'VPS (SSH)',
    description: 'Despliega tu app full-stack a tu propio servidor VPS (Hostinger VPS o cualquier SSH) y córrela con PM2',
    descriptionEn: 'Deploy your full-stack app to your own VPS (Hostinger VPS or any SSH server) and run it with PM2',
    icon: 'server',
    color: '#0EA5E9',
    requiredFields: [
      { name: 'host', label: 'Host / IP', labelEn: 'Host / IP', type: 'text', placeholder: '123.45.67.89' },
      { name: 'port', label: 'Puerto SSH', labelEn: 'SSH Port', type: 'text', placeholder: '22' },
      { name: 'username', label: 'Usuario SSH', labelEn: 'SSH User', type: 'text', placeholder: 'root' },
      { name: 'password', label: 'Contraseña SSH', labelEn: 'SSH Password', type: 'password', placeholder: '••••••••' },
      { name: 'deployPath', label: 'Ruta de despliegue', labelEn: 'Deploy Path', type: 'text', placeholder: '/var/www/miapp' },
      { name: 'appName', label: 'Nombre de la app (PM2)', labelEn: 'App Name (PM2)', type: 'text', placeholder: 'miapp' },
      { name: 'appPort', label: 'Puerto de la app', labelEn: 'App Port', type: 'text', placeholder: '3000' },
      { name: 'domain', label: 'Dominio (opcional)', labelEn: 'Domain (optional)', type: 'text', placeholder: 'miapp.com' },
    ],
    instructions: '1. Contrata un VPS (Hostinger VPS, DigitalOcean, etc.) con Node.js instalado\n2. Anota la IP/host, el puerto SSH (normalmente 22) y tu usuario (a menudo root)\n3. Define una ruta de despliegue (ej. /var/www/miapp) y un puerto para la app (ej. 3000)\n4. OCTOPUS subirá tu proyecto por SSH, hará npm install + build y lo dejará corriendo con PM2\n\n🔒 Tus credenciales SSH se guardan cifradas en el servidor y NUNCA pasan por ningún modelo de IA.',
    instructionsEn: '1. Get a VPS (Hostinger VPS, DigitalOcean, etc.) with Node.js installed\n2. Note the IP/host, SSH port (usually 22) and your user (often root)\n3. Set a deploy path (e.g. /var/www/myapp) and an app port (e.g. 3000)\n4. OCTOPUS uploads your project over SSH, runs npm install + build, and keeps it running with PM2\n\n🔒 Your SSH credentials are stored server-side and NEVER pass through any AI model.',
  },
  whatsapp: {
    type: 'whatsapp',
    name: 'WhatsApp',
    description: 'WhatsApp Business vía Twilio — OCTOPUS responde con IA en tu número',
    descriptionEn: 'WhatsApp Business via Twilio — OCTOPUS replies with AI on your number',
    icon: 'message-circle',
    color: '#25D366',
    requiredFields: [
      { name: 'accountSid', label: 'Account SID (Twilio)', labelEn: 'Account SID (Twilio)', type: 'text', placeholder: 'ACxxxxxxxxxxxxxxxx' },
      { name: 'authToken', label: 'Auth Token (Twilio)', labelEn: 'Auth Token (Twilio)', type: 'password', placeholder: 'Tu auth token' },
      { name: 'phoneNumber', label: 'Número de WhatsApp', labelEn: 'WhatsApp Number', type: 'text', placeholder: 'whatsapp:+14155238886' },
    ],
    instructions: '1. Crea una cuenta en twilio.com\n2. Activa el Sandbox de WhatsApp (Messaging > Try it out)\n3. Copia tu Account SID y Auth Token de la consola\n4. Configura el webhook en Twilio: /api/channels/whatsapp/webhook\n5. También puedes configurarlo desde Omnicanal en el dashboard',
    instructionsEn: '1. Create an account at twilio.com\n2. Activate the WhatsApp Sandbox (Messaging > Try it out)\n3. Copy your Account SID and Auth Token from the console\n4. Set the webhook in Twilio: /api/channels/whatsapp/webhook\n5. You can also configure it from Omnichannel in the dashboard',
  },
  sms: {
    type: 'sms',
    name: 'SMS',
    description: 'SMS vía Twilio — controla OCTOPUS por mensaje de texto clásico',
    descriptionEn: 'SMS via Twilio — control OCTOPUS via classic text message',
    icon: 'smartphone',
    color: '#6366F1',
    requiredFields: [
      { name: 'accountSid', label: 'Account SID (Twilio)', labelEn: 'Account SID (Twilio)', type: 'text', placeholder: 'ACxxxxxxxxxxxxxxxx' },
      { name: 'authToken', label: 'Auth Token (Twilio)', labelEn: 'Auth Token (Twilio)', type: 'password', placeholder: 'Tu auth token' },
      { name: 'phoneNumber', label: 'Número Twilio', labelEn: 'Twilio Number', type: 'text', placeholder: '+14155238886' },
    ],
    instructions: '1. Crea una cuenta en twilio.com y compra un número con SMS\n2. Copia tu Account SID y Auth Token\n3. Configura el webhook del número: /api/channels/sms/webhook\n4. También puedes configurarlo desde Omnicanal en el dashboard',
    instructionsEn: '1. Create an account at twilio.com and buy an SMS-enabled number\n2. Copy your Account SID and Auth Token\n3. Set the number webhook: /api/channels/sms/webhook\n4. You can also configure it from Omnichannel in the dashboard',
  },
  ollama: {
    type: 'ollama',
    name: 'Ollama',
    description: 'Modelos de IA locales detectados automáticamente en tu equipo (privacidad total, ejecución offline)',
    descriptionEn: 'Local AI models auto-detected on your machine (full privacy, offline execution)',
    icon: 'cpu',
    color: '#00B4D8',
    isAutoDetected: true,
    requiredFields: [],
    instructions: 'Ollama se detecta automáticamente cuando el Octopus Bridge está corriendo en tu equipo. No necesitas configuración manual — el Bridge escanea tu sistema y reporta los modelos disponibles, incluso si Ollama está cerrado.',
    instructionsEn: 'Ollama is auto-detected when the Octopus Bridge is running on your machine. No manual configuration needed — the Bridge scans your system and reports available models, even if Ollama is closed.',
    services: [
      { name: 'HTTP Detection', icon: 'wifi', description: 'Si Ollama está corriendo en :11434', descriptionEn: 'If Ollama is running on :11434' },
      { name: 'System Detection', icon: 'hard-drive', description: 'Lee modelos del directorio Ollama del usuario incluso cerrado', descriptionEn: 'Reads models from user Ollama directory even when closed' },
      { name: 'Full Privacy', icon: 'shield', description: 'Los modelos nunca salen de tu equipo', descriptionEn: 'Models never leave your machine' },
    ],
  },
  google_workspace: {
    type: 'google_workspace',
    name: 'Google Workspace',
    description: 'Calendar, Drive, Docs, Sheets y Gmail — todo tu ecosistema Google conectado a Octopus',
    descriptionEn: 'Calendar, Drive, Docs, Sheets & Gmail — your entire Google ecosystem connected to Octopus',
    icon: 'chrome',
    color: '#4285F4',
    isOAuth: true,
    oauthScopes: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
    ],
    requiredFields: [],
    instructions: 'Conecta tu cuenta de Google con un solo clic. Octopus accederá a Calendar, Drive, Docs, Sheets y Gmail para ejecutar tareas en tu nombre.',
    instructionsEn: 'Connect your Google account with a single click. Octopus will access Calendar, Drive, Docs, Sheets and Gmail to execute tasks on your behalf.',
    services: [
      { name: 'Calendar', icon: 'calendar', description: 'Eventos, reuniones y agenda', descriptionEn: 'Events, meetings and schedule' },
      { name: 'Drive', icon: 'hard-drive', description: 'Archivos y carpetas en la nube', descriptionEn: 'Cloud files and folders' },
      { name: 'Docs', icon: 'file-text', description: 'Documentos de Google', descriptionEn: 'Google Documents' },
      { name: 'Sheets', icon: 'table', description: 'Hojas de cálculo', descriptionEn: 'Spreadsheets' },
      { name: 'Gmail', icon: 'mail', description: 'Correos y mensajes', descriptionEn: 'Emails and messages' },
    ],
  },
  smtp: {
    type: 'smtp',
    name: 'SMTP Email',
    description: 'Envía emails profesionales desde tu dominio usando cualquier proveedor SMTP (Hostinger, Zoho, GoDaddy, etc.)',
    descriptionEn: 'Send professional emails from your domain using any SMTP provider (Hostinger, Zoho, GoDaddy, etc.)',
    icon: 'at-sign',
    color: '#8B5CF6',
    requiredFields: [
      { name: 'host', label: 'Servidor SMTP', labelEn: 'SMTP Server', type: 'text', placeholder: 'smtp.hostinger.com' },
      { name: 'port', label: 'Puerto', labelEn: 'Port', type: 'text', placeholder: '465' },
      { name: 'email', label: 'Email', labelEn: 'Email', type: 'text', placeholder: 'team@your-domain.com' },
      { name: 'password', label: 'Contraseña', labelEn: 'Password', type: 'password', placeholder: '••••••••' },
      { name: 'fromName', label: 'Nombre del remitente', labelEn: 'Sender name', type: 'text', placeholder: 'Tu Marca / Your Brand' },
    ],
    instructions: '1. Ve al panel de tu hosting (Hostinger, cPanel, etc.)\n2. Busca la sección de "Email" o "Cuentas de correo"\n3. Crea una cuenta de email (ej: team@tu-dominio.com)\n4. Busca los datos SMTP (servidor, puerto, usuario, contraseña)\n\n📧 **Datos comunes:**\n- Hostinger: smtp.hostinger.com, puerto 465\n- Zoho: smtp.zoho.com, puerto 465\n- GoDaddy: smtpout.secureserver.net, puerto 465\n- cPanel: mail.tu-dominio.com, puerto 465',
    instructionsEn: '1. Go to your hosting panel (Hostinger, cPanel, etc.)\n2. Find the "Email" or "Email Accounts" section\n3. Create an email account (e.g., team@your-domain.com)\n4. Find the SMTP details (server, port, username, password)\n\n📧 **Common SMTP settings:**\n- Hostinger: smtp.hostinger.com, port 465\n- Zoho: smtp.zoho.com, port 465\n- GoDaddy: smtpout.secureserver.net, port 465\n- cPanel: mail.your-domain.com, port 465',
  },
  browser_automation: {
    type: 'browser_automation',
    name: 'Browser Automation',
    description: 'Controla cualquier sitio web desde OCTOPUS — publica en redes, automatiza CRMs, llena formularios y más',
    descriptionEn: 'Control any website from OCTOPUS — post on social media, automate CRMs, fill forms and more',
    icon: 'monitor',
    color: '#F59E0B',
    isAutoDetected: true,
    requiredFields: [],
    instructions: 'El Browser Brazo se activa automáticamente cuando el Octopus Browser Bridge está corriendo en tu equipo. Descarga el script, ejecútalo con Node.js, y OCTOPUS podrá controlar un navegador real en tu PC.',
    instructionsEn: 'The Browser Arm activates automatically when the Octopus Browser Bridge is running on your machine. Download the script, run it with Node.js, and OCTOPUS will control a real browser on your PC.',
    services: [
      { name: 'Web Navigation', icon: 'globe', description: 'Navega a cualquier URL y toma capturas', descriptionEn: 'Navigate to any URL and take screenshots' },
      { name: 'Click & Type', icon: 'mouse-pointer', description: 'Clics, formularios, scroll — como un humano', descriptionEn: 'Clicks, forms, scroll — like a human' },
      { name: 'Social Media', icon: 'share-2', description: 'Publica en Instagram, Twitter, LinkedIn, Publer...', descriptionEn: 'Post on Instagram, Twitter, LinkedIn, Publer...' },
      { name: 'Data Extraction', icon: 'database', description: 'Extrae datos de cualquier web visible', descriptionEn: 'Extract data from any visible website' },
    ],
  },
  web3forms: {
    type: 'web3forms',
    name: 'Web3Forms',
    description: 'Formularios de contacto funcionales — los emails de tus landings llegan a tu bandeja',
    descriptionEn: 'Functional contact forms — emails from your landings go straight to your inbox',
    icon: 'mail-check',
    color: '#22C55E',
    requiredFields: [
      { name: 'accessKey', label: 'Access Key', labelEn: 'Access Key', type: 'password', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
    ],
    instructions: '1. Ve a web3forms.com y crea una cuenta gratis\n2. Ingresa tu email donde quieres recibir los mensajes\n3. Copia el Access Key que te genera\n4. Pégalo aquí — ¡listo! Todos los formularios que genere Code Engine enviarán a tu email',
    instructionsEn: '1. Go to web3forms.com and create a free account\n2. Enter the email where you want to receive messages\n3. Copy the Access Key it generates\n4. Paste it here — done! All forms generated by Code Engine will send to your email',
  },
}
