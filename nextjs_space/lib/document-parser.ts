/**
 * OCTOPUS Document Parser
 * Extrae texto de documentos Word (.docx), Excel (.xlsx/.xls), CSV y TXT
 * Los PDFs se envían directamente al LLM como base64
 */

import mammoth from 'mammoth'
import * as XLSX from 'xlsx'

export interface ParsedDocument {
  text: string
  pageCount?: number
  metadata?: Record<string, string>
  type: 'pdf' | 'docx' | 'xlsx' | 'csv' | 'txt' | 'unknown'
  name: string
}

// Tipos de documento soportados
export const SUPPORTED_DOC_TYPES: Record<string, { mime: string[]; ext: string[]; label: string; icon: string }> = {
  pdf: {
    mime: ['application/pdf'],
    ext: ['.pdf'],
    label: 'PDF',
    icon: '📄',
  },
  docx: {
    mime: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'],
    ext: ['.docx', '.doc'],
    label: 'Word',
    icon: '📝',
  },
  xlsx: {
    mime: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'],
    ext: ['.xlsx', '.xls'],
    label: 'Excel',
    icon: '📊',
  },
  csv: {
    mime: ['text/csv'],
    ext: ['.csv'],
    label: 'CSV',
    icon: '📋',
  },
  txt: {
    mime: ['text/plain'],
    ext: ['.txt'],
    label: 'Texto',
    icon: '📃',
  },
}

// Todos los tipos MIME aceptados
export const ACCEPTED_DOC_MIMES = Object.values(SUPPORTED_DOC_TYPES)
  .flatMap(t => t.mime)
  .join(',')

// Todas las extensiones aceptadas
export const ACCEPTED_DOC_EXTENSIONS = Object.values(SUPPORTED_DOC_TYPES)
  .flatMap(t => t.ext)
  .join(',')

/**
 * Detecta el tipo de documento a partir de su nombre y MIME type
 */
export function detectDocumentType(fileName: string, mimeType?: string): ParsedDocument['type'] {
  const ext = fileName.toLowerCase().split('.').pop() || ''
  
  if (ext === 'pdf' || mimeType?.includes('pdf')) return 'pdf'
  if (ext === 'docx' || ext === 'doc' || mimeType?.includes('wordprocessing') || mimeType?.includes('msword')) return 'docx'
  if (ext === 'xlsx' || ext === 'xls' || mimeType?.includes('spreadsheet') || mimeType?.includes('ms-excel')) return 'xlsx'
  if (ext === 'csv' || mimeType?.includes('csv')) return 'csv'
  if (ext === 'txt' || mimeType?.includes('text/plain')) return 'txt'
  
  return 'unknown'
}

/**
 * Verifica si un archivo es un documento soportado
 */
export function isDocumentFile(fileName: string, mimeType?: string): boolean {
  return detectDocumentType(fileName, mimeType) !== 'unknown'
}

/**
 * Verifica si un archivo es una imagen
 */
export function isImageFile(mimeType: string): boolean {
  return mimeType.startsWith('image/')
}

/**
 * Obtiene el icono del tipo de documento
 */
export function getDocumentIcon(type: ParsedDocument['type']): string {
  const icons: Record<string, string> = {
    pdf: '📄',
    docx: '📝',
    xlsx: '📊',
    csv: '📋',
    txt: '📃',
    unknown: '📎',
  }
  return icons[type] || '📎'
}

/**
 * Obtiene la etiqueta del tipo de documento
 */
export function getDocumentLabel(type: ParsedDocument['type']): string {
  const labels: Record<string, string> = {
    pdf: 'PDF',
    docx: 'Word',
    xlsx: 'Excel',
    csv: 'CSV',
    txt: 'Texto',
    unknown: 'Documento',
  }
  return labels[type] || 'Documento'
}

/**
 * Extrae texto de un documento Word (.docx)
 */
export async function parseDocx(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer })
    return result.value.trim()
  } catch (error) {
    console.error('Error parsing DOCX:', error)
    throw new Error('No se pudo leer el documento Word')
  }
}

// Límite de tamaño del buffer para parsing seguro (10MB)
const MAX_BUFFER_SIZE = 10 * 1024 * 1024

/**
 * Extrae texto de un documento Excel (.xlsx/.xls)
 * Convierte cada hoja en una tabla legible
 * PROTECCIÓN: Limita filas leídas y tamaño del buffer para evitar OOM
 */
export function parseExcel(buffer: Buffer): string {
  try {
    // Protección contra archivos enormes
    if (buffer.length > MAX_BUFFER_SIZE) {
      console.warn(`[OCTOPUS Doc] Excel buffer demasiado grande: ${(buffer.length / 1024 / 1024).toFixed(1)}MB — limitando parsing`)
    }

    // sheetRows limita las filas que se parsean POR HOJA (evita OOM en archivos grandes)
    const workbook = XLSX.read(buffer, { 
      type: 'buffer', 
      sheetRows: 300,   // Solo leer primeras 300 filas por hoja
      dense: false,
    })
    const sheets: string[] = []
    
    // Máximo 5 hojas para evitar output gigante
    const sheetNames = workbook.SheetNames.slice(0, 5)
    
    for (const sheetName of sheetNames) {
      const sheet = workbook.Sheets[sheetName]
      if (!sheet) continue
      
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as (string | number)[][]
      
      if (jsonData.length === 0) continue
      
      let sheetText = `\n=== Hoja: ${sheetName} ===\n`
      
      // Máximo 200 filas en el output
      const maxRows = Math.min(jsonData.length, 200)
      for (let i = 0; i < maxRows; i++) {
        const row = jsonData[i]
        if (row && row.length > 0) {
          // Limitar columnas a 20 y largo de celda a 100 chars
          const cells = row.slice(0, 20).map(cell => {
            if (cell === undefined || cell === null) return ''
            const s = String(cell)
            return s.length > 100 ? s.slice(0, 100) + '…' : s
          })
          sheetText += cells.join(' | ') + '\n'
        }
      }
      
      if (jsonData.length > 200) {
        sheetText += `\n... (más filas no mostradas)\n`
      }
      
      sheets.push(sheetText)
    }
    
    if (workbook.SheetNames.length > 5) {
      sheets.push(`\n... (${workbook.SheetNames.length - 5} hojas más no mostradas)`)
    }
    
    return sheets.join('\n') || 'Documento Excel vacío'
  } catch (error) {
    console.error('Error parsing Excel:', error)
    throw new Error('No se pudo leer el documento Excel')
  }
}

/**
 * Extrae texto de un CSV
 */
export function parseCsv(textContent: string): string {
  // Limitar a primeras 200 líneas
  const lines = textContent.split('\n')
  const limited = lines.slice(0, 200).join('\n')
  if (lines.length > 200) {
    return limited + `\n\n... (${lines.length - 200} líneas más no mostradas)`
  }
  return limited
}

// Límite máximo de base64 para procesar (20MB de base64 ≈ 15MB archivo real)
const MAX_BASE64_LENGTH = 20 * 1024 * 1024

/**
 * Ejecuta una función con timeout
 */
function withTimeout<T>(fn: () => T | Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout: ${label} excedió ${ms / 1000}s`))
    }, ms)
    
    try {
      const result = fn()
      if (result instanceof Promise) {
        result
          .then(val => { clearTimeout(timer); resolve(val) })
          .catch(err => { clearTimeout(timer); reject(err) })
      } else {
        clearTimeout(timer)
        resolve(result)
      }
    } catch (err) {
      clearTimeout(timer)
      reject(err)
    }
  })
}

/**
 * Procesa un documento y extrae su contenido como texto
 * Para PDFs, retorna null (se envían directamente al LLM como base64)
 * PROTECCIÓN: Timeout de 15s, límite de tamaño base64, truncamiento agresivo
 */
export async function extractDocumentText(
  base64Data: string,
  fileName: string,
  mimeType?: string
): Promise<{ text: string | null; type: ParsedDocument['type']; isPdf: boolean }> {
  const docType = detectDocumentType(fileName, mimeType)
  
  if (docType === 'pdf') {
    return { text: null, type: 'pdf', isPdf: true }
  }
  
  // Protección: rechazar base64 extremadamente grande
  const base64Len = (base64Data || '').length
  if (base64Len > MAX_BASE64_LENGTH) {
    console.warn(`[OCTOPUS Doc] base64 demasiado grande: ${(base64Len / 1024 / 1024).toFixed(1)}MB — rechazado`)
    return { 
      text: `⚠️ El archivo "${fileName}" es demasiado grande (${(base64Len * 0.75 / 1024 / 1024).toFixed(0)}MB). Por favor sube un archivo de máximo 15MB o un extracto más pequeño.`, 
      type: docType, 
      isPdf: false 
    }
  }
  
  // Remover el prefijo data:... si existe
  const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data
  const buffer = Buffer.from(cleanBase64, 'base64')
  
  console.log(`[OCTOPUS Doc] Buffer size: ${(buffer.length / 1024 / 1024).toFixed(2)}MB for ${docType}`)
  
  try {
    switch (docType) {
      case 'docx': {
        const text = await withTimeout(() => parseDocx(buffer), 15000, 'parseDocx')
        return { text, type: 'docx', isPdf: false }
      }
      case 'xlsx': {
        const text = await withTimeout(() => parseExcel(buffer), 15000, 'parseExcel')
        return { text, type: 'xlsx', isPdf: false }
      }
      case 'csv': {
        const textContent = buffer.toString('utf-8')
        const text = parseCsv(textContent)
        return { text, type: 'csv', isPdf: false }
      }
      case 'txt': {
        const text = buffer.toString('utf-8').slice(0, 50000)
        return { text, type: 'txt', isPdf: false }
      }
      default:
        return { text: 'Tipo de documento no soportado', type: 'unknown', isPdf: false }
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error(`[OCTOPUS Doc] Error extrayendo texto de ${fileName}:`, errMsg)
    if (errMsg.includes('Timeout')) {
      return {
        text: `⚠️ El archivo "${fileName}" es demasiado complejo para procesarse rápidamente. Intenta con un archivo más pequeño o un extracto específico.`,
        type: docType,
        isPdf: false,
      }
    }
    throw err
  }
}
