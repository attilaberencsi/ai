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

/** Without `--skill` the CLI shows a checklist of the repository's skills; `-g` installs globally and skips the scope question. */
export const skillBrowseCommand = (skill: Skill, global = false): string =>
  ['npx', 'skills', 'add', skillSource(skill), ...(global ? ['-g'] : [])].map(shellQuote).join(' ')

/** Only shows the skills available in the repository; installs nothing. */
export const skillListCommand = (skill: Skill): string => [skillBrowseCommand(skill), '--list'].join(' ')

/** Every flag the generated commands use; scripts/check-refs.ts verifies them against `npx skills add --help`. */
export const SKILLS_CLI_FLAGS = ['--skill', '-a', '-g', '--list'] as const

/**
 * What a generated command really does, read from its syntax (behaviour taken from the skills CLI source):
 * - without `--skill` (and without `--list`) the CLI asks which skills to install;
 * - without `-a` it installs to the agents it detects on the machine and asks only when it finds several (or none),
 *   so no command can promise "you pick the agents": `agents: 'detected'`;
 * - without `-g` it asks for the scope (there is no flag for "project", so Project entries still show that question).
 */
export function describeSkillCommand(command: string) {
  const t = command.split(' ')
  const list = t.includes('--list')
  return {
    installs: !list,
    asksSkills: !list && !t.includes('--skill'),
    agents: t.includes('-a') ? ('fixed' as const) : ('detected' as const),
    asksScope: !list && !t.includes('-g'),
  }
}

/**
 * Dropdown entries: first the two ways to look at the whole repository, then one entry per (agent, scope) that installs
 * exactly this skill. Texts must match `describeSkillCommand` (enforced by tests): "detected agents" is not a picker.
 */
export function skillTargets(skill: Skill): InstallOption[] {
  const repoWide: InstallOption[] = [
    {
      id: 'browse',
      key: 'browse',
      label: 'Browse and choose skills in this repo (terminal)',
      scopes: ['project'],
      scope: 'project',
      copy: skillBrowseCommand(skill),
      target: 'asks you which skills and scope; agents are detected (asked only if several are found)',
      note: 'Shows a checklist of every skill in the repository. Nothing is installed until you confirm.',
    },
    {
      id: 'list',
      key: 'list',
      label: 'List skills in this repo (preview only)',
      scopes: ['project'],
      scope: 'project',
      copy: skillListCommand(skill),
      target: 'nowhere (preview only, nothing is installed)',
      note: 'Only shows the skills available in the repository.',
    },
  ]
  const entries: { id: string; label: string; project: string; global: string; agentId?: string }[] = [
    { id: 'detected', label: 'Auto detect target agent', project: 'the agents the CLI detects here', global: 'the agents the CLI detects here' },
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
        note:
          (!a.agentId ? 'Installs this skill to the agents the CLI detects on this machine; it asks only if it finds several (or none), so choose an agent below to be exact. ' : '') +
          (global ? 'Installs for your user account, available in every project.' : 'Run this in your project folder. The CLI asks for the scope: choose Project.'),
      }
    }),
  )
  return [...repoWide, ...perAgent]
}
