import { describe, expect, it } from 'vitest'
import { SKILLS_CLI_FLAGS, SKILL_AGENTS, describeSkillCommand, skillBrowseCommand, skillCommand, skillListCommand, skillSource, skillTargets, sortSkills } from './skills'
import { CATALOG_KEY, type Skill, type SkillEntry } from './types'

const skill: Skill = { name: 'clean-abap', description: 'd', source: 'attilaberencsi/sapskills', repository: 'https://github.com/attilaberencsi/sapskills' }
const entry = (name: string): SkillEntry => ({ skill: { ...skill, name }, _meta: { [CATALOG_KEY]: { category: 'X' } } })

describe('skillCommand', () => {
  it('builds the plain interactive command', () => {
    expect(skillCommand(skill)).toBe('npx skills add attilaberencsi/sapskills --skill clean-abap')
  })
  it('adds the agent and the global flag', () => {
    expect(skillCommand(skill, 'claude-code')).toBe('npx skills add attilaberencsi/sapskills --skill clean-abap -a claude-code')
    expect(skillCommand(skill, 'github-copilot', true)).toBe('npx skills add attilaberencsi/sapskills --skill clean-abap -a github-copilot -g')
  })
})

describe('skills on a branch', () => {
  const onBranch: Skill = { ...skill, name: 'cap-mtx', source: 'capire/skills', ref: 'devtoberfest' }
  it('uses owner/repo#ref as the source', () => {
    expect(skillSource(onBranch)).toBe('capire/skills#devtoberfest')
    expect(skillSource(skill)).toBe('attilaberencsi/sapskills')
  })
  it('quotes the source so the # is safe in a shell', () => {
    expect(skillCommand(onBranch)).toBe("npx skills add 'capire/skills#devtoberfest' --skill cap-mtx")
    expect(skillTargets(onBranch).every((t) => t.copy!.includes("'capire/skills#devtoberfest'"))).toBe(true)
  })
})

describe('browsing the whole repository', () => {
  const onBranch: Skill = { ...skill, name: 'cap-cds-review', source: 'capire/skills', ref: 'devtoberfest' }
  it('browse has no --skill, so the CLI lists the repo and lets you choose', () => {
    expect(skillBrowseCommand(onBranch)).toBe("npx skills add 'capire/skills#devtoberfest'")
    expect(skillBrowseCommand(skill)).toBe('npx skills add attilaberencsi/sapskills')
  })
  it('list only previews', () => {
    expect(skillListCommand(onBranch)).toBe("npx skills add 'capire/skills#devtoberfest' --list")
  })
  it('are the first two dropdown entries', () => {
    const targets = skillTargets(onBranch)
    expect(targets.slice(0, 2).map((t) => t.key)).toEqual(['browse', 'list'])
    expect(targets[0].copy).not.toContain('--skill')
    expect(targets[1].copy).toContain('--list')
    expect(targets.slice(2).every((t) => t.copy!.includes('--skill cap-cds-review'))).toBe(true)
  })
})

describe('skillTargets', () => {
  const targets = skillTargets(skill)
  it('offers project and global scope for the terminal choice and every agent, with unique keys', () => {
    expect(new Set(targets.map((t) => t.key)).size).toBe(targets.length)
    expect(targets.map((t) => t.key)).toEqual(expect.arrayContaining(['detected:project', 'detected:user', 'claude-code:project', 'claude-code:user', 'gemini-cli:user']))
  })
  it('maps global scope to -g and project scope to no flag', () => {
    expect(targets.find((t) => t.key === 'claude-code:user')!.copy).toContain(' -g')
    expect(targets.find((t) => t.key === 'claude-code:project')!.copy).not.toContain(' -g')
    expect(targets.find((t) => t.key === 'detected:project')!.copy).not.toContain(' -a ')
  })
  it('names where each agent reads skills from', () => {
    expect(targets.find((t) => t.key === 'claude-code:project')!.target).toContain('.claude/skills/')
    expect(targets.find((t) => t.key === 'github-copilot:user')!.target).toContain('~/.copilot/skills/')
  })
  it('labels the scopes Project and Global', () => {
    expect(targets.find((t) => t.key === 'cursor:user')!.label).toBe('Cursor · Global')
    expect(targets.find((t) => t.key === 'cursor:project')!.label).toBe('Cursor · Project')
  })
})

describe('dropdown text matches the command syntax', () => {
  const onBranch: Skill = { ...skill, name: 'cap-cds-review', source: 'capire/skills', ref: 'devtoberfest' }
  const targets = skillTargets(onBranch)
  const text = (t: (typeof targets)[number]) => `${t.label} ${t.target} ${t.note}`.toLowerCase()

  it('never promises that you pick agents (the CLI cannot force that question)', () => {
    for (const t of targets) expect(text(t)).not.toMatch(/pick agents|choose agents|you pick/)
  })
  it('only uses flags the CLI knows', () => {
    for (const t of targets) {
      const flags = t.copy!.split(' ').filter((x) => x.startsWith('-'))
      for (const f of flags) expect(SKILLS_CLI_FLAGS as readonly string[]).toContain(f)
    }
  })
  it('every entry says what its command does', () => {
    for (const t of targets) {
      const d = describeSkillCommand(t.copy!)
      const label = t.label.toLowerCase()
      if (label.startsWith('browse')) expect(d).toMatchObject({ installs: true, asksSkills: true, asksScope: true })
      else if (label.startsWith('list')) expect(d.installs).toBe(false)
      else {
        // install entries: exactly this skill, scope given in the label
        expect(d.asksSkills).toBe(false)
        expect(d.asksScope).toBe(!t.copy!.includes(' -g'))
        if (d.asksScope) expect(text(t)).toContain('asks for the scope')
        expect(t.copy).toContain('--skill cap-cds-review')
        expect(label.endsWith('global')).toBe(t.copy!.includes(' -g'))
        const agent = SKILL_AGENTS.find((a) => label.startsWith(a.label.toLowerCase()))
        if (agent) expect(t.copy).toContain(` -a ${agent.id}`)
        else expect(d.agents).toBe('detected')
      }
    }
  })
  it('entries that let the CLI decide say so', () => {
    for (const t of targets.filter((x) => describeSkillCommand(x.copy!).agents === 'detected' && x.copy!.includes('--skill'))) {
      expect(text(t)).toContain('detect')
    }
  })
  it('browse follows the same rule', () => {
    expect(skillBrowseCommand(onBranch, true)).toBe("npx skills add 'capire/skills#devtoberfest' -g")
    expect(text(targets[0])).toContain('asks you which skills')
  })
})

describe('sortSkills', () => {
  it('sorts alphabetically without mutating the input', () => {
    const list = [entry('karpathy'), entry('Clean-abap'), entry('abap-x')]
    expect(sortSkills(list).map((s) => s.skill.name)).toEqual(['abap-x', 'Clean-abap', 'karpathy'])
    expect(list.map((s) => s.skill.name)).toEqual(['karpathy', 'Clean-abap', 'abap-x'])
  })
})
