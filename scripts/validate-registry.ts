// Validates registry/servers.json: every `server` against the pinned official server.schema.json,
// plus our extension block under _meta. Exits non-zero on any problem.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'

const root = resolve(import.meta.dirname, '..')
const schema = JSON.parse(readFileSync(resolve(root, 'registry/schema/server.schema.json'), 'utf8'))
const data = JSON.parse(readFileSync(resolve(root, 'registry/servers.json'), 'utf8'))

const ajv = new Ajv({ allErrors: true, strict: false })
addFormats(ajv)
const validateServer = ajv.compile(schema)

const CATALOG_KEY = 'io.github.attilaberencsi/catalog'
const errors: string[] = []
const seen = new Set<string>()

if (!Array.isArray(data.servers)) errors.push('servers.json: "servers" must be an array')

for (const [i, entry] of (data.servers ?? []).entries()) {
  const label = entry?.server?.name ?? `#${i}`
  if (!validateServer(entry.server)) {
    for (const e of validateServer.errors ?? []) errors.push(`${label}: server${e.instancePath} ${e.message}`)
  }
  const key = `${entry.server?.name}@${entry.server?.version}`
  if (seen.has(key)) errors.push(`${label}: duplicate name@version`)
  seen.add(key)

  const meta = entry._meta?.[CATALOG_KEY]
  if (!meta || typeof meta.category !== 'string' || !meta.category.trim()) {
    errors.push(`${label}: _meta["${CATALOG_KEY}"].category is required`)
  }
  if (meta?.tags !== undefined && !(Array.isArray(meta.tags) && meta.tags.every((t: unknown) => typeof t === 'string'))) {
    errors.push(`${label}: catalog.tags must be string[]`)
  }
  if (meta?.notes !== undefined && !(Array.isArray(meta.notes) && meta.notes.every((t: unknown) => typeof t === 'string'))) {
    errors.push(`${label}: catalog.notes must be string[]`)
  }
  if (!entry.server?.remotes?.length && !entry.server?.packages?.length) {
    errors.push(`${label}: needs at least one remote or package to be installable`)
  }
}

if (errors.length) {
  console.error(`Registry validation failed (${errors.length}):\n` + errors.map((e) => `  - ${e}`).join('\n'))
  process.exit(1)
}
console.log(`Registry OK: ${data.servers.length} servers`)
