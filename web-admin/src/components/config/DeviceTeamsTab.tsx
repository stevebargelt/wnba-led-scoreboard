import { ReactElement, useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Button, Card, CardHeader, CardTitle, Toggle } from '../ui'

interface SportConfig {
  sport: string
  enabled: boolean
  priority: number
  favorite_teams: string[]
}

interface TeamEntry {
  team_id: string
  name: string
  abbreviation: string
}

function isEqual(a: SportConfig[], b: SportConfig[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function getLeagueStyles(sport: string): {
  badge: string
  pill: string
  pillText: string
  removeBtn: string
} {
  const code = sport.toLowerCase()
  if (code === 'wnba') {
    return {
      badge: 'bg-[var(--color-league-wnba)] text-[var(--color-league-wnba-fg)]',
      pill: 'bg-[var(--color-league-wnba-soft)]',
      pillText: 'text-[var(--color-league-wnba)]',
      removeBtn: 'text-[var(--color-league-wnba)] hover:opacity-70',
    }
  }
  if (code === 'nhl') {
    return {
      badge: 'bg-[var(--color-league-nhl)] text-[var(--color-league-nhl-fg)]',
      pill: 'bg-[var(--color-league-nhl-soft)]',
      pillText: 'text-[var(--color-league-nhl)]',
      removeBtn: 'text-[var(--color-league-nhl)] hover:opacity-70',
    }
  }
  return {
    badge: 'bg-accent text-accent-fg',
    pill: 'bg-accent-soft',
    pillText: 'text-[var(--color-accent-soft-fg)]',
    removeBtn: 'text-[var(--color-accent-soft-fg)] hover:opacity-70',
  }
}

export function DeviceTeamsTab({ deviceId }: { deviceId: string }): ReactElement {
  const [configs, setConfigs] = useState<SportConfig[]>([])
  const [clean, setClean] = useState<SportConfig[]>([])
  const [directory, setDirectory] = useState<Record<string, TeamEntry[]>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [message, setMessage] = useState('')
  const addInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const makeRefCallback = useCallback(
    (sport: string) => (el: HTMLInputElement | null) => {
      addInputRefs.current[sport] = el
    },
    []
  )

  const isDirty = !isEqual(configs, clean)

  useEffect(() => {
    ;(async () => {
      const { data: sess } = await supabase.auth.getSession()
      const jwt = sess.session?.access_token
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (jwt) headers['Authorization'] = `Bearer ${jwt}`

      const [sRes, cRes] = await Promise.all([
        fetch('/api/sports', { headers }),
        fetch(`/api/device/${deviceId}/sports`, { headers }),
      ])

      if (sRes.ok) {
        const sJson = await sRes.json()
        const sports: Record<string, any[]> = sJson.sports || {}
        const dir: Record<string, TeamEntry[]> = {}
        for (const [sport, teams] of Object.entries(sports)) {
          dir[sport] = (teams as any[]).map(t => ({
            team_id: String(t.id),
            name: String(t.name),
            abbreviation: String(t.abbreviation || t.abbr || t.id).toUpperCase(),
          }))
        }
        setDirectory(dir)
      }

      if (cRes.ok) {
        const cJson = await cRes.json()
        const loaded: SportConfig[] = (cJson.sportConfigs || []).map((c: any) => ({
          sport: String(c.sport),
          enabled: Boolean(c.enabled),
          priority: Number(c.priority),
          favorite_teams: Array.isArray(c.favorite_teams) ? c.favorite_teams.map(String) : [],
        }))
        setConfigs(loaded)
        setClean(loaded)
      }
    })()
  }, [deviceId])

  function toggleEnabled(sport: string, enabled: boolean) {
    setConfigs(prev => prev.map(c => (c.sport === sport ? { ...c, enabled } : c)))
  }

  function removeTeam(sport: string, teamId: string) {
    setConfigs(prev =>
      prev.map(c =>
        c.sport === sport
          ? { ...c, favorite_teams: c.favorite_teams.filter(id => id !== teamId) }
          : c
      )
    )
  }

  function addTeam(sport: string, teamId: string) {
    setConfigs(prev => {
      const hasTeam = prev.some(c => c.sport === sport && c.favorite_teams.includes(teamId))
      if (hasTeam) return prev
      return prev.map(c =>
        c.sport !== sport ? c : { ...c, favorite_teams: [...c.favorite_teams, teamId] }
      )
    })
    const input = addInputRefs.current[sport]
    if (input) input.value = ''
  }

  function handleAddInput(sport: string, value: string) {
    const teams = directory[sport] || []
    const match = teams.find(
      t => t.name.toLowerCase() === value.toLowerCase() || t.abbreviation === value.toUpperCase()
    )
    if (!match) return
    const sportConfig = configs.find(c => c.sport === sport)
    if (sportConfig?.favorite_teams.includes(match.team_id)) return
    addTeam(sport, match.team_id)
  }

  async function save() {
    const { data: sess } = await supabase.auth.getSession()
    const jwt = sess.session?.access_token
    if (!jwt) return

    setIsSaving(true)
    setMessage('')
    try {
      const resp = await fetch(`/api/device/${deviceId}/sports`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({
          sportConfigs: configs.map(c => ({
            sport: c.sport,
            enabled: c.enabled,
            priority: c.priority,
            favorite_teams: c.favorite_teams,
          })),
        }),
      })
      if (resp.ok) {
        setClean(configs)
        setMessage('Teams saved. Panel updates on its next poll.')
      } else {
        const body = await resp.json()
        setMessage(`Save failed: ${body?.error || 'Unknown error'}`)
      }
    } finally {
      setIsSaving(false)
    }
  }

  function discard() {
    setConfigs(clean)
    setMessage('')
  }

  const sorted = [...configs].sort((a, b) => a.priority - b.priority)

  return (
    <div className="space-y-4">
      {isDirty && (
        <div
          role="alert"
          className="rounded-token-sm bg-amber-soft border border-[var(--color-amber)] px-4 py-2 text-sm text-amber-fg"
        >
          Unsaved changes
        </div>
      )}
      {message && <p className="text-sm text-[var(--color-text-secondary)]">{message}</p>}
      {sorted.map(config => {
        const teamList = directory[config.sport] || []
        const favSet = new Set(config.favorite_teams)
        const styles = getLeagueStyles(config.sport)

        return (
          <Card key={config.sport}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-semibold ${styles.badge}`}
                  >
                    {config.sport.toUpperCase()}
                  </span>
                </div>
                <Toggle
                  checked={config.enabled}
                  onChange={enabled => toggleEnabled(config.sport, enabled)}
                />
              </div>
            </CardHeader>
            <div>
              {config.enabled ? (
                <>
                  {config.favorite_teams.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {config.favorite_teams.map(teamId => {
                        const team = teamList.find(t => t.team_id === teamId)
                        const label = team?.abbreviation || teamId.slice(0, 3).toUpperCase()
                        return (
                          <span
                            key={teamId}
                            className={`inline-flex items-center gap-1 rounded-pill ${styles.pill} ${styles.pillText} px-3 py-1 text-sm font-medium`}
                          >
                            <span className="font-mono-machine text-xs font-semibold">{label}</span>
                            {team?.name && <span className="opacity-80">{team.name}</span>}
                            <button
                              type="button"
                              onClick={() => removeTeam(config.sport, teamId)}
                              className={`ml-1 ${styles.removeBtn} focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)] rounded-full`}
                              aria-label={`Remove ${label}`}
                            >
                              ×
                            </button>
                          </span>
                        )
                      })}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      id={`add-team-${config.sport}`}
                      list={`teams-${config.sport}`}
                      ref={makeRefCallback(config.sport)}
                      placeholder="Add team…"
                      aria-label={`Add ${config.sport.toUpperCase()} team`}
                      className="flex-1 h-[38px] rounded-token-sm border border-[var(--color-border)] bg-[var(--color-surface-3)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                      onChange={e => handleAddInput(config.sport, e.target.value)}
                    />
                    <datalist id={`teams-${config.sport}`}>
                      {teamList
                        .filter(t => !favSet.has(t.team_id))
                        .map(t => (
                          <option key={t.team_id} value={t.name} />
                        ))}
                    </datalist>
                  </div>
                </>
              ) : (
                <p className="text-sm text-[var(--color-text-muted)] italic">
                  Enable {config.sport.toUpperCase()} to pick favorite teams.
                </p>
              )}
            </div>
          </Card>
        )
      })}
      <div className="flex justify-end gap-3">
        <Button variant="secondary" disabled={!isDirty} onClick={discard}>
          Discard
        </Button>
        <Button disabled={!isDirty || isSaving} loading={isSaving} onClick={save}>
          Save Teams
        </Button>
      </div>
    </div>
  )
}
