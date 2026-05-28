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
    setConfigs(prev =>
      prev.map(c => (c.sport === sport ? { ...c, enabled } : c))
    )
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
          className="rounded-md bg-amber-50 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-600 px-4 py-2 text-sm text-amber-800 dark:text-amber-200"
        >
          Unsaved changes
        </div>
      )}
      {message && (
        <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>
      )}
      {sorted.map(config => {
        const teamList = directory[config.sport] || []
        const favSet = new Set(config.favorite_teams)
        return (
          <Card key={config.sport}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{config.sport.toUpperCase()}</CardTitle>
                <Toggle
                  checked={config.enabled}
                  onChange={enabled => toggleEnabled(config.sport, enabled)}
                />
              </div>
            </CardHeader>
            <div className={config.enabled ? '' : 'opacity-50'}>
              <div className="flex flex-wrap gap-2 mb-3">
                {config.favorite_teams.map(teamId => {
                  const team = teamList.find(t => t.team_id === teamId)
                  const label = team?.abbreviation || teamId.slice(0, 3).toUpperCase()
                  return (
                    <span
                      key={teamId}
                      className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-900 px-3 py-1 text-sm text-blue-800 dark:text-blue-200"
                    >
                      {label}
                      <button
                        type="button"
                        disabled={!config.enabled}
                        onClick={() => removeTeam(config.sport, teamId)}
                        className="ml-1 text-blue-600 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100 disabled:pointer-events-none"
                        aria-label={`Remove ${label}`}
                      >
                        ×
                      </button>
                    </span>
                  )
                })}
              </div>
              <div className="flex gap-2">
                <input
                  id={`add-team-${config.sport}`}
                  list={`teams-${config.sport}`}
                  ref={makeRefCallback(config.sport)}
                  disabled={!config.enabled}
                  placeholder="Add team…"
                  aria-label={`Add ${config.sport.toUpperCase()} team`}
                  className="flex-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white px-3 py-1.5 text-sm disabled:opacity-50"
                  onChange={e => handleAddInput(config.sport, e.target.value)}
                />
                <datalist id={`teams-${config.sport}`}>
                  {teamList.filter(t => !favSet.has(t.team_id)).map(t => (
                    <option key={t.team_id} value={t.name} />
                  ))}
                </datalist>
              </div>
            </div>
          </Card>
        )
      })}
      <div className="flex justify-end gap-3">
        <Button
          variant="secondary"
          disabled={!isDirty}
          onClick={discard}
        >
          Discard
        </Button>
        <Button
          disabled={!isDirty || isSaving}
          loading={isSaving}
          onClick={save}
        >
          Save
        </Button>
      </div>
    </div>
  )
}
