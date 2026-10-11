<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import registryUrl from '../../registry/servers.json?url'
import { categoriesOf, inCategory, loadRegistry } from '../lib/registry'
import type { ServerEntry } from '../lib/types'
import CategoryTabs from './CategoryTabs.vue'
import ServerCard from './ServerCard.vue'

const ALL = 'All'
const servers = ref<ServerEntry[]>([])
const status = ref<'loading' | 'ready' | 'error'>('loading')
const error = ref('')
const active = ref(ALL)

const categories = computed(() => [ALL, ...categoriesOf(servers.value)])
const visible = computed(() => inCategory(servers.value, active.value === ALL ? null : active.value))
const counts = computed(() => Object.fromEntries(categories.value.map((c) => [c, inCategory(servers.value, c === ALL ? null : c).length])))

function readHash() {
  const c = decodeURIComponent(location.hash.replace(/^#/, ''))
  active.value = categories.value.includes(c) ? c : ALL
}
function select(c: string) {
  active.value = c
  history.replaceState(null, '', c === ALL ? location.pathname : `#${encodeURIComponent(c)}`)
}

onMounted(async () => {
  window.addEventListener('hashchange', readHash)
  try {
    servers.value = (await loadRegistry(registryUrl)).servers
    status.value = 'ready'
    readHash()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    status.value = 'error'
  }
})
onUnmounted(() => window.removeEventListener('hashchange', readHash))
</script>

<template>
  <main>
    <section class="page-head">
      <h1>MCP <span class="grad">Servers</span></h1>
      <p>Library contains items used by a human (me). The list grows slowly over time, because here you see validated and tested content only.</p>
    </section>

    <p v-if="status === 'loading'" class="state" role="status">Loading servers…</p>
    <p v-else-if="status === 'error'" class="state error" role="alert">Could not load the registry: {{ error }}</p>

    <template v-else>
      <CategoryTabs :categories="categories" :active="active" :counts="counts" panel-id="panel" @select="select" />

      <div id="panel" role="tabpanel" class="grid">
        <ServerCard v-for="e in visible" :key="`${e.server.name}@${e.server.version}`" :entry="e" />
        <p v-if="!visible.length" class="state">No servers in this category yet.</p>
      </div>
    </template>
  </main>
</template>
