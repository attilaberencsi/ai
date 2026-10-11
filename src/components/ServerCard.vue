<script setup lang="ts">
import { computed, ref } from 'vue'
import { useClipboard } from '../lib/clipboard'
import { installTargets, launchSpec } from '../lib/install'
import { catalogOf } from '../lib/registry'
import type { ServerEntry } from '../lib/types'

const props = defineProps<{ entry: ServerEntry }>()

const server = computed(() => props.entry.server)
const meta = computed(() => catalogOf(props.entry))
const targets = computed(() => installTargets(server.value))
const selectedKey = ref('vscode:user')
const selected = computed(() => targets.value.find((t) => t.key === selectedKey.value) ?? targets.value[0])
const kind = computed(() => {
  const s = launchSpec(server.value)
  return s ? (s.kind === 'remote' ? 'Remote' : 'Local') : 'n/a'
})
const title = computed(() => server.value.title ?? server.value.name.split('/').pop() ?? server.value.name)
const repo = computed(() => server.value.repository?.url ?? server.value.websiteUrl)

const { copied, copy } = useClipboard()
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

    <ul v-if="meta.notes?.length" class="setup" aria-label="Setup notes" tabindex="0">
      <li v-for="n in meta.notes" :key="n">{{ n }}</li>
    </ul>

    <div class="install">
      <label class="sr-only" :for="`target-${server.name}`">Install in</label>
      <select :id="`target-${server.name}`" v-model="selectedKey" class="select">
        <option v-for="t in targets" :key="t.key" :value="t.key">{{ t.label }}</option>
      </select>

      <div v-if="selected && !selected.unavailable" class="actions">
        <a
          v-if="selected.link"
          class="btn primary"
          :href="selected.link"
          :target="selected.link.startsWith('http') ? '_blank' : undefined"
          rel="noopener"
        >
          {{ selected.linkLabel ?? 'Open' }}
        </a>
        <button class="btn" :disabled="!selected.copy" @click="selected.copy && copy(selected.copy)">
          {{ copied ? 'Copied ✓' : 'Copy' }}
        </button>
      </div>

      <p v-if="selected?.unavailable" class="note warn">{{ selected.unavailable }}</p>
      <template v-else-if="selected">
        <p class="target">Installs to: {{ selected.target }}</p>
        <pre v-if="selected.copy" class="preview" tabindex="0"><code>{{ selected.copy }}</code></pre>
        <p v-if="selected.note" class="note">{{ selected.note }}</p>
      </template>
      <span class="sr-only" role="status">{{ copied ? 'Copied to clipboard' : '' }}</span>
    </div>

    <footer v-if="repo">
      <a :href="repo" target="_blank" rel="noopener">Repository / website ↗</a>
    </footer>
  </article>
</template>
