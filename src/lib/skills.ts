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

/** Source argument for the CLI: `owner/repo`, or `owner/repo#ref` for a branch or tag. */
export const skillSource = (skill: Skill): string => (skill.ref ? `${skill.source}#${skill.ref}` : skill.source)

/** `npx skills add <source> --skill <name> [-a <agent>] [-g]` */
export function skillCommand(skill: Skill, agentId?: string, global = false): string {
  const parts = ['npx', 'skills', 'add', skillSource(skill), '--skill', skill.name]
  if (agentId) parts.push('-a', agentId)
  if (global) parts.push('-g')
  return parts.map(shellQuote).join(' ')
}

/** Without `--skill` the CLI lists the repository's skills and lets you pick skills, agents and scope in the terminal. */
export const skillBrowseCommand = (skill: Skill): string => ['npx', 'skills', 'add', skillSource(skill)].map(shellQuote).join(' ')

/** Only shows the skills available in the repository; installs nothing. */
export const skillListCommand = (skill: Skill): string => [skillBrowseCommand(skill), '--list'].join(' ')

/**
 * Dropdown entries: first the two ways to look at the whole repository (browse and pick, or just list), then one entry
 * per (agent, scope) that installs exactly this skill. "Pick agents in terminal" installs this skill but lets you choose the agents.
 */
export function skillTargets(skill: Skill): InstallOption[] {
  const repoWide: InstallOption[] = [
    {
      id: 'browse',
      key: 'browse',
      label: 'Browse all skills in this repo (terminal)',
      scopes: ['project', 'user'],
      scope: 'project',
      copy: skillBrowseCommand(skill),
      target: 'wherever you choose in the terminal (skills, agents and scope)',
      note: 'Lists every skill in the repository and lets you pick which to install - this skill is one of them.',
    },
    {
      id: 'list',
      key: 'list',
      label: 'List skills in this repo (preview only)',
      scopes: ['project', 'user'],
      scope: 'project',
      copy: skillListCommand(skill),
      target: 'nowhere (preview only, nothing is installed)',
      note: 'Only shows the skills available in the repository.',
    },
  ]
  const entries: { id: string; label: string; project: string; global: string; agentId?: string }[] = [
    { id: 'interactive', label: 'Pick agents in terminal', project: 'the agent folders you pick', global: 'the agent folders you pick' },
    ...SKILL_AGENTS.map((a) => ({ ...a, agentId: a.id })),
  ]
  const perAgent = entries.flatMap((a) =>
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
  return [...repoWide, ...perAgent]
}
