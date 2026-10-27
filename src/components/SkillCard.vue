<script setup lang="ts">
import { computed, ref } from 'vue'
import { useClipboard } from '../lib/clipboard'
import { catalogOf } from '../lib/registry'
import { skillSource, skillTargets } from '../lib/skills'
import type { SkillEntry } from '../lib/types'

const props = defineProps<{ entry: SkillEntry }>()

const skill = computed(() => props.entry.skill)
const meta = computed(() => catalogOf(props.entry))
const targets = computed(() => skillTargets(skill.value))
const selectedKey = ref('claude-code:project')
const selected = computed(() => targets.value.find((t) => t.key === selectedKey.value) ?? targets.value[0])

const { copied, copy } = useClipboard()
</script>

<template>
  <article class="server">
    <header>
      <span class="avatar" aria-hidden="true">{{ skill.name.charAt(0).toUpperCase() }}</span>
      <div>
        <h2>{{ skill.name }}</h2>
        <code class="name">{{ skillSource(skill) }}</code>
      </div>
    </header>

    <p class="desc">{{ skill.description }}</p>

    <ul class="chips" aria-label="Details">
      <li v-if="skill.ref" class="chip hl" title="Not on the default branch yet">branch: {{ skill.ref }}</li>
      <li v-if="skill.license" class="chip">{{ skill.license }}</li>
      <li v-for="t in meta.tags ?? []" :key="t" class="chip">{{ t }}</li>
    </ul>

    <ul v-if="meta.notes?.length" class="setup" aria-label="Notes" tabindex="0">
      <li v-for="n in meta.notes" :key="n">{{ n }}</li>
    </ul>

    <div class="install">
      <label class="sr-only" :for="`target-${skill.name}`">Install for</label>
      <select :id="`target-${skill.name}`" v-model="selectedKey" class="select">
        <option v-for="t in targets" :key="t.key" :value="t.key">{{ t.label }}</option>
      </select>

      <div class="actions">
        <button class="btn primary" :disabled="!selected?.copy" @click="selected?.copy && copy(selected.copy)">
          {{ copied ? 'Copied ✓' : 'Copy command' }}
        </button>
      </div>

      <template v-if="selected">
        <p class="target">Installs to: {{ selected.target }}</p>
        <pre class="preview" tabindex="0"><code>{{ selected.copy }}</code></pre>
        <p v-if="selected.note" class="note">{{ selected.note }}</p>
      </template>
      <span class="sr-only" role="status">{{ copied ? 'Copied to clipboard' : '' }}</span>
    </div>

    <footer>
      <a :href="skill.repository" target="_blank" rel="noopener">Repository ↗</a>
      <a v-if="skill.website" :href="skill.website" target="_blank" rel="noopener" class="more">Article ↗</a>
    </footer>
  </article>
</template>
