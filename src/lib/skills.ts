import type { InstallOption, Scope } from './install'
import { shellQuote } from './install'
import type { Skill, SkillEntry } from './types'

export interface SkillsRegistry {
  skills: SkillEntry[]
}

/** Alphabetical by skill name, case-insensitive; does not mutate the input. */
export function sortSkills(skills: SkillEntry[]): SkillEntry[] {
  return [...skills].sort((a, b) => a.skill.name.localeCompare(b.skill.name, 'en', { sensitivity: 'base', numeric: true }))
}

export async function loadSkills(url: string): Promise<SkillsRegistry> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Skills request failed (${res.status})`)
  const data = (await res.json()) as SkillsRegistry
  if (!Array.isArray(data.skills)) throw new Error('Skills file is malformed: "skills" array missing')
  return { skills: sortSkills(data.skills) }
}

/** Agents supported by `npx skills add -a <id>`, with where each one reads skills from. Paths: vercel-labs/skills README. */
export const SKILL_AGENTS: { id: string; label: string; project: string; global: string }[] = [
  { id: 'claude-code', label: 'Claude Code', project: '.claude/skills/', global: '~/.claude/skills/' },
  { id: 'github-copilot', label: 'GitHub Copilot', project: '.agents/skills/', global: '~/.copilot/skills/' },
  { id: 'cursor', label: 'Cursor', project: '.agents/skills/', global: '~/.cursor/skills/' },
  { id: 'codex', label: 'Codex CLI', project: '.agents/skills/', global: '~/.agents/skills/' },
  { id: 'gemini-cli', label: 'Gemini CLI', project: '.agents/skills/', global: '~/.gemini/skills/' },
]

const SCOPE_NAME: Partial<Record<Scope, string>> = { project: 'Project', user: 'Global' }

/** `npx skills add <source> --skill <name> [-a <agent>] [-g]` */
export function skillCommand(skill: Skill, agentId?: string, global = false): string {
  const parts = ['npx', 'skills', 'add', skill.source, '--skill', skill.name]
  if (agentId) parts.push('-a', agentId)
  if (global) parts.push('-g')
  return parts.map(shellQuote).join(' ')
}

/** One entry per (agent, scope), plus "choose in the terminal" entries that leave the agent choice to the CLI. */
export function skillTargets(skill: Skill): InstallOption[] {
  const entries: { id: string; label: string; project: string; global: string; agentId?: string }[] = [
    { id: 'interactive', label: 'Choose agents in terminal', project: 'the agent folders you pick', global: 'the agent folders you pick' },
    ...SKILL_AGENTS.map((a) => ({ ...a, agentId: a.id })),
  ]
  return entries.flatMap((a) =>
    (['project', 'user'] as const).map((scope): InstallOption => {
      const global = scope === 'user'
      return {
        id: a.id,
        key: `${a.id}:${scope}`,
        label: `${a.label} · ${SCOPE_NAME[scope]}`,
        scopes: ['project', 'user'],
        scope,
        copy: skillCommand(skill, a.agentId, global),
        target: global ? `${a.global} (all your projects)` : `${a.project} in the folder you run it from (commit it to share)`,
        note: global
          ? 'Installs for your user account, available in every project.'
          : 'Run this in your project folder. Add -y to skip the confirmation prompts.',
      }
    }),
  )
}
