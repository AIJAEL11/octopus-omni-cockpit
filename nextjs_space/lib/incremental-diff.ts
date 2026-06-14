/**
 * Diff incremental para el Code Engine (Fase 3).
 *
 * Cuando el LLM regenera un proyecto suele reescribir archivos que no cambiaron
 * (mismo contenido byte a byte). Persistir esas escrituras infla la base de
 * datos y obliga al runtime de WebContainers a re-montar archivos idénticos.
 *
 * Esta función compara cada write_file en cola contra el contenido actual del
 * mismo path en la sesión y descarta los que no cambiaron. Solo toca
 * write_file: create_dir, delete_file, run_command, etc. pasan intactos.
 */

export interface DiffableCommand {
  type: string
  payload: Record<string, unknown>
}

export interface IncrementalDiffResult<T extends DiffableCommand> {
  /** Comandos a conservar (escrituras sin cambios eliminadas). */
  commands: T[]
  /** Paths cuya escritura se omitió por ser idéntica. */
  unchanged: string[]
  /** Paths que sí se escriben (nuevos o modificados). */
  changed: string[]
}

/** Normaliza un path de archivo para comparar (separadores + slashes iniciales). */
function normPath(p: unknown): string {
  return String(p || '').replace(/\\/g, '/').replace(/^\/+/, '')
}

/**
 * Filtra los write_file sin cambios respecto al estado actual de la sesión.
 *
 * @param staged   comandos en cola (post-transformaciones)
 * @param existing mapa path → contenido actual (último write por path gana)
 */
export function filterUnchangedWrites<T extends DiffableCommand>(
  staged: T[],
  existing: Map<string, string>,
): IncrementalDiffResult<T> {
  const unchanged: string[] = []
  const changed: string[] = []
  const commands: T[] = []

  for (const cmd of staged) {
    if (cmd.type !== 'write_file') {
      commands.push(cmd)
      continue
    }
    const path = normPath(cmd.payload.path)
    const content = cmd.payload.content
    // Sin path o contenido no-string → no podemos comparar, conservar por seguridad.
    if (!path || typeof content !== 'string') {
      commands.push(cmd)
      continue
    }
    const prev = existing.get(path)
    if (prev !== undefined && prev === content) {
      unchanged.push(path)
      continue // idéntico → omitir la escritura
    }
    changed.push(path)
    commands.push(cmd)
  }

  return { commands, unchanged, changed }
}
