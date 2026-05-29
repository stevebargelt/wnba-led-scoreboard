import { ReactElement, useCallback, useEffect, useRef, useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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

// Grip handle icon — a 2×3 grid of dots (braille ⠿ look-alike via SVG for reliable rendering)
function GripIcon() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="12"
      height="14"
      viewBox="0 0 12 14"
      fill="currentColor"
      style={{ flexShrink: 0 }}
    >
      <circle cx="3" cy="2" r="1.25" />
      <circle cx="9" cy="2" r="1.25" />
      <circle cx="3" cy="7" r="1.25" />
      <circle cx="9" cy="7" r="1.25" />
      <circle cx="3" cy="12" r="1.25" />
      <circle cx="9" cy="12" r="1.25" />
    </svg>
  )
}

interface SortablePillProps {
  teamId: string
  ordinal: number
  label: string
  name?: string
  styles: ReturnType<typeof getLeagueStyles>
  onRemove: () => void
  isDragging?: boolean
}

function SortablePill({
  teamId,
  ordinal,
  label,
  name,
  styles,
  onRemove,
  isDragging,
}: SortablePillProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: teamId,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.4 : 1,
    cursor: isSortableDragging ? 'grabbing' : undefined,
  }

  return (
    <span
      ref={setNodeRef}
      style={style}
      className={`inline-flex items-center gap-1 rounded-pill ${styles.pill} ${styles.pillText} px-3 py-1 text-sm font-medium ${isDragging ? 'shadow-lg ring-2 ring-[var(--color-accent)] opacity-100' : ''}`}
    >
      {/* Ordinal rank badge */}
      <span
        className="text-[10px] font-bold opacity-60 mr-0.5 leading-none"
        aria-label={`rank ${ordinal}`}
      >
        {ordinal}
      </span>
      {/* Grip handle — keyboard focusable drag trigger */}
      <button
        type="button"
        className={`opacity-40 hover:opacity-70 focus-visible:opacity-90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)] rounded-sm ${styles.pillText}`}
        style={{ cursor: isSortableDragging ? 'grabbing' : 'grab', lineHeight: 0, padding: '1px' }}
        aria-label={`Drag to reorder ${label}`}
        {...attributes}
        {...listeners}
      >
        <GripIcon />
      </button>
      <span className="font-mono-machine text-xs font-semibold">{label}</span>
      {name && <span className="opacity-80">{name}</span>}
      <button
        type="button"
        onClick={onRemove}
        className={`ml-1 ${styles.removeBtn} focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-accent)] rounded-full`}
        aria-label={`Remove ${label}`}
      >
        ×
      </button>
    </span>
  )
}

// A static (non-sortable) version used in DragOverlay to show the floating clone
function StaticPill({
  label,
  name,
  styles,
}: {
  label: string
  name?: string
  styles: ReturnType<typeof getLeagueStyles>
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-pill ${styles.pill} ${styles.pillText} px-3 py-1 text-sm font-medium shadow-xl ring-2 ring-[var(--color-accent)]`}
      style={{ cursor: 'grabbing' }}
    >
      <span className="opacity-40" style={{ lineHeight: 0, padding: '1px' }}>
        <GripIcon />
      </span>
      <span className="font-mono-machine text-xs font-semibold">{label}</span>
      {name && <span className="opacity-80">{name}</span>}
    </span>
  )
}

interface LeaguePillsProps {
  sport: string
  favoriteTeams: string[]
  teamList: TeamEntry[]
  styles: ReturnType<typeof getLeagueStyles>
  onReorder: (newOrder: string[]) => void
  onRemove: (teamId: string) => void
}

function LeaguePills({
  sport,
  favoriteTeams,
  teamList,
  styles,
  onReorder,
  onRemove,
}: LeaguePillsProps) {
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveId(null)
    if (!over || active.id === over.id) return
    const oldIndex = favoriteTeams.indexOf(String(active.id))
    const newIndex = favoriteTeams.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) return
    onReorder(arrayMove(favoriteTeams, oldIndex, newIndex))
  }

  const activeTeam = activeId ? teamList.find(t => t.team_id === activeId) : null
  const activeLabel =
    activeTeam?.abbreviation || (activeId ? activeId.slice(0, 3).toUpperCase() : '')

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        accessibility={{
          announcements: {
            onDragStart: ({ active }) => {
              const t = teamList.find(x => x.team_id === active.id)
              return `Picked up ${t?.name ?? active.id}. Use arrow keys to move, Space to drop.`
            },
            onDragOver: ({ active, over }) => {
              if (!over) return
              const t = teamList.find(x => x.team_id === over.id)
              return `${teamList.find(x => x.team_id === active.id)?.name ?? active.id} is over ${t?.name ?? over.id}.`
            },
            onDragEnd: ({ active, over }) => {
              if (!over)
                return `${teamList.find(x => x.team_id === active.id)?.name ?? active.id} dropped.`
              return `${teamList.find(x => x.team_id === active.id)?.name ?? active.id} dropped at position ${favoriteTeams.indexOf(String(over.id)) + 1}.`
            },
            onDragCancel: ({ active }) =>
              `Drag cancelled. ${teamList.find(x => x.team_id === active.id)?.name ?? active.id} returned to original position.`,
          },
        }}
      >
        <SortableContext items={favoriteTeams} strategy={horizontalListSortingStrategy}>
          <div className="flex flex-wrap gap-2 mb-1">
            {favoriteTeams.map((teamId, index) => {
              const team = teamList.find(t => t.team_id === teamId)
              const label = team?.abbreviation || teamId.slice(0, 3).toUpperCase()
              return (
                <SortablePill
                  key={teamId}
                  teamId={teamId}
                  ordinal={index + 1}
                  label={label}
                  name={team?.name}
                  styles={styles}
                  onRemove={() => onRemove(teamId)}
                />
              )
            })}
          </div>
        </SortableContext>
        <DragOverlay>
          {activeId ? (
            <StaticPill label={activeLabel} name={activeTeam?.name} styles={styles} />
          ) : null}
        </DragOverlay>
      </DndContext>
      {favoriteTeams.length >= 2 && (
        <p className="text-xs text-[var(--color-text-muted)] mt-1 mb-2">
          Drag to reorder — leftmost plays first.
        </p>
      )}
    </>
  )
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

  function reorderTeams(sport: string, newOrder: string[]) {
    setConfigs(prev => prev.map(c => (c.sport === sport ? { ...c, favorite_teams: newOrder } : c)))
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
                    <LeaguePills
                      sport={config.sport}
                      favoriteTeams={config.favorite_teams}
                      teamList={teamList}
                      styles={styles}
                      onReorder={newOrder => reorderTeams(config.sport, newOrder)}
                      onRemove={teamId => removeTeam(config.sport, teamId)}
                    />
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
