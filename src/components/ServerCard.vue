<script setup lang="ts">
import { computed, ref } from 'vue'
import { SCOPE_LABELS, installOptions, launchSpec, type Scope } from '../lib/install'
import { catalogOf } from '../lib/registry'
import type { ServerEntry } from '../lib/types'

const props = defineProps<{ entry: ServerEntry }>()

const server = computed(() => props.entry.server)
const meta = computed(() => catalogOf(props.entry))
const scope = ref<Scope>('user')
const options = computed(() => installOptions(server.value, scope.value))
const vscode = computed(() => options.value.find((o) => o.id === 'vscode'))
const selectedId = ref('claude-code')
const selected = computed(() => options.value.find((o) => o.id === selectedId.value) ?? options.value[0])
// Scopes offered in the dropdown: those the selected client supports.
const scopeChoices = computed(() => selected.value?.scopes ?? [])
const scopeNotHonored = computed(() => selected.value && selected.value.scope !== scope.value)
const kind = computed(() => {
  const s = launchSpec(server.value)
  return s ? (s.kind === 'remote' ? 'Remote' : 'Local') : 'n/a'
})
const title = computed(() => server.value.title ?? server.value.name.split('/').pop() ?? server.value.name)
const repo = computed(() => server.value.repository?.url ?? server.value.websiteUrl)

const copied = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // Fallback for non-secure contexts / denied permission.
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }
  copied.value = true
  clearTimeout(timer)
  timer = setTimeout(() => (copied.value = false), 1800)
}
</script>

<template>
  <article class="server">
    <header>
      <span class="avatar" aria-hidden="true">{{ title.charAt(0).toUpperCase() }}</span>
      <div>
        <h2>{{ title }}</h2>
        <code class="name">{{ server.name }}</code>
      </div>
    </header>

    <p class="desc">{{ server.description }}</p>

    <ul class="chips" aria-label="Details">
      <li class="chip hl">{{ kind }}</li>
      <li class="chip">v{{ server.version }}</li>
      <li v-for="t in meta.tags ?? []" :key="t" class="chip">{{ t }}</li>
    </ul>

    <div class="install">
      <a v-if="vscode?.link" class="btn primary" :href="vscode.link">Install in VS Code</a>
      <button v-else-if="vscode?.copy" class="btn primary" @click="copy(vscode.copy)">Copy .vscode/mcp.json entry</button>
      <button v-else class="btn primary" disabled :title="vscode?.unavailable">Install in VS Code</button>

      <div class="copy-row">
        <label class="sr-only" :for="`client-${server.name}`">Install for</label>
        <select :id="`client-${server.name}`" v-model="selectedId" class="select">
          <option v-for="o in options" :key="o.id" :value="o.id">{{ o.label }}</option>
        </select>
        <button class="btn" :disabled="!selected?.copy" @click="selected?.copy && copy(selected.copy)">
          {{ copied ? 'Copied ✓' : 'Copy' }}
        </button>
        <a v-if="selected?.link && selected.id !== 'vscode'" class="btn" :href="selected.link" :target="selected.link.startsWith('http') ? '_blank' : undefined" rel="noopener">
          {{ selected.linkLabel ?? 'Open' }}
        </a>
      </div>

      <div class="scope-row">
        <label :for="`scope-${server.name}`">Scope</label>
        <select :id="`scope-${server.name}`" v-model="scope" class="select" :disabled="scopeChoices.length < 2">
          <option v-for="s in (['user', 'project', 'local'] as Scope[])" :key="s" :value="s" :disabled="!scopeChoices.includes(s)">
            {{ SCOPE_LABELS[s] }}
          </option>
        </select>
      </div>
      <p v-if="selected && !selected.unavailable" class="target">
        Installs to: {{ selected.target }}
        <span v-if="scopeNotHonored"> - {{ selected.label }} has no {{ SCOPE_LABELS[scope].split(' ')[0].toLowerCase() }} scope; using {{ selected.scope }}.</span>
      </p>

      <p v-if="selected?.unavailable" class="note warn">{{ selected.unavailable }}</p>
      <template v-else>
        <pre v-if="selected?.copy" class="preview" tabindex="0"><code>{{ selected.copy }}</code></pre>
        <p v-if="selected?.note" class="note">{{ selected.note }}</p>
      </template>
      <span class="sr-only" role="status">{{ copied ? 'Copied to clipboard' : '' }}</span>
    </div>

    <footer v-if="repo">
      <a :href="repo" target="_blank" rel="noopener">Repository / website ↗</a>
    </footer>
  </article>
</template>
