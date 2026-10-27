import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createSSRApp, type Component } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it } from 'vitest'
import ServerCard from './ServerCard.vue'
import SkillCard from './SkillCard.vue'

const read = (f: string) => JSON.parse(readFileSync(resolve(import.meta.dirname, '../../registry', f), 'utf8'))
const render = (component: Component, props: Record<string, unknown>) => renderToString(createSSRApp(component, props))

describe('SkillCard', () => {
  it('renders every skill from registry/skills.json with its install command', async () => {
    for (const entry of read('skills.json').skills) {
      const html = await render(SkillCard, { entry })
      expect(html).toContain(entry.skill.name)
      expect(html).toContain(`--skill ${entry.skill.name} -a claude-code`)
      expect(html).toContain(entry.skill.ref ? `branch: ${entry.skill.ref}` : entry.skill.source)
      expect(html).toContain('Copy command')
    }
  })
  it('lists agent and scope combinations in the dropdown', async () => {
    const html = await render(SkillCard, { entry: read('skills.json').skills[0] })
    expect(html).toContain('Claude Code · Project')
    expect(html).toContain('GitHub Copilot · Global')
  })
})

describe('ServerCard', () => {
  it('renders every server from registry/servers.json with the combined client/scope dropdown', async () => {
    for (const entry of read('servers.json').servers) {
      const html = await render(ServerCard, { entry })
      expect(html).toContain('VS Code · User')
      expect(html).toContain('Claude Code · Project')
    }
  })
})
