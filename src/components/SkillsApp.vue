<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import skillsUrl from '../../registry/skills.json?url'
import { categoriesOf, inCategory } from '../lib/registry'
import { loadSkills } from '../lib/skills'
import type { SkillEntry } from '../lib/types'
import CategoryTabs from './CategoryTabs.vue'
import SkillCard from './SkillCard.vue'

const ALL = 'All'
const skills = ref<SkillEntry[]>([])
const status = ref<'loading' | 'ready' | 'error'>('loading')
const error = ref('')
const active = ref(ALL)

const categories = computed(() => [ALL, ...categoriesOf(skills.value)])
const visible = computed(() => inCategory(skills.value, active.value === ALL ? null : active.value))
const counts = computed(() => Object.fromEntries(categories.value.map((c) => [c, inCategory(skills.value, c === ALL ? null : c).length])))

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
    skills.value = (await loadSkills(skillsUrl)).skills
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
      <h1>Agent <span class="grad">Skills</span></h1>
      <p>
        Installed with <code>npx skills add</code> into Claude Code, GitHub Copilot, Cursor, Codex CLI, Gemini CLI and more. Pick a target, then copy the command.
      </p>
    </section>

    <p v-if="status === 'loading'" class="state" role="status">Loading skills…</p>
    <p v-else-if="status === 'error'" class="state error" role="alert">Could not load the skills: {{ error }}</p>

    <template v-else>
      <CategoryTabs :categories="categories" :active="active" :counts="counts" panel-id="panel" @select="select" />

      <div id="panel" role="tabpanel" class="grid">
        <SkillCard v-for="e in visible" :key="e.skill.name" :entry="e" />
        <p v-if="!visible.length" class="state">No skills in this category yet.</p>
      </div>
    </template>
  </main>
</template>
