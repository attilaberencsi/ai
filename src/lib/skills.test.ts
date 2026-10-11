import { describe, expect, it } from 'vitest'
import { skillCommand, skillTargets, sortSkills } from './skills'
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

describe('skillTargets', () => {
  const targets = skillTargets(skill)
  it('offers project and global scope for the terminal choice and every agent, with unique keys', () => {
    expect(new Set(targets.map((t) => t.key)).size).toBe(targets.length)
    expect(targets.map((t) => t.key)).toEqual(expect.arrayContaining(['interactive:project', 'interactive:user', 'claude-code:project', 'claude-code:user', 'gemini-cli:user']))
  })
  it('maps global scope to -g and project scope to no flag', () => {
    expect(targets.find((t) => t.key === 'claude-code:user')!.copy).toContain(' -g')
    expect(targets.find((t) => t.key === 'claude-code:project')!.copy).not.toContain(' -g')
    expect(targets.find((t) => t.key === 'interactive:project')!.copy).not.toContain(' -a ')
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

describe('sortSkills', () => {
  it('sorts alphabetically without mutating the input', () => {
    const list = [entry('karpathy'), entry('Clean-abap'), entry('abap-x')]
    expect(sortSkills(list).map((s) => s.skill.name)).toEqual(['abap-x', 'Clean-abap', 'karpathy'])
    expect(list.map((s) => s.skill.name)).toEqual(['karpathy', 'Clean-abap', 'abap-x'])
  })
})
