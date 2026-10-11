<script setup lang="ts">
const props = defineProps<{ categories: string[]; active: string; counts: Record<string, number>; panelId: string }>()
const emit = defineEmits<{ select: [category: string] }>()

function onKey(e: KeyboardEvent, i: number) {
  const n = props.categories.length
  const next = e.key === 'ArrowRight' ? (i + 1) % n : e.key === 'ArrowLeft' ? (i + n - 1) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1
  if (next < 0) return
  e.preventDefault()
  emit('select', props.categories[next])
  document.getElementById(`tab-${next}`)?.focus()
}
</script>

<template>
  <div class="tabs" role="tablist" aria-label="Categories">
    <button
      v-for="(c, i) in categories"
      :id="`tab-${i}`"
      :key="c"
      role="tab"
      class="tab"
      :aria-selected="c === active"
      :aria-controls="panelId"
      :tabindex="c === active ? 0 : -1"
      @click="emit('select', c)"
      @keydown="onKey($event, i)"
    >
      {{ c }} <span class="count">{{ counts[c] }}</span>
    </button>
  </div>
</template>
