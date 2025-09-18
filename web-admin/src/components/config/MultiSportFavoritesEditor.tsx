import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs'
import { useMultiSportTeams, Team } from '@/lib/useMultiSportTeams'
import { supabase } from '@/lib/supabaseClient'

interface FavoriteTeam {
  name: string
  abbr: string
  id?: string
}

interface SportConfig {
  sport: 'wnba' | 'nhl'
  enabled: boolean
  favorites: FavoriteTeam[]
}

type SportKey = 'wnba' | 'nhl'

interface MultiSportFavoritesEditorProps {
  deviceId: string
  onConfigChange: (config: { sports: SportConfig[] }) => void
  initialConfig?: { sports: SportConfig[] }
}

const SPORT_INFO = {
  wnba: {
    name: 'WNBA',
    icon: '🏀',
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    description: "Women's National Basketball Association",
  },
  nhl: {
    name: 'NHL',
    icon: '🏒',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    description: 'National Hockey League',
  },
}

export function MultiSportFavoritesEditor({
  deviceId,
  onConfigChange,
  initialConfig,
}: MultiSportFavoritesEditorProps) {
  const { teams, loading, error } = useMultiSportTeams()
  const [sportConfigs, setSportConfigs] = useState<Record<SportKey, SportConfig>>(() => ({
    wnba: {
      sport: 'wnba',
      enabled: true,
      favorites: [],
    },
    nhl: {
      sport: 'nhl',
      enabled: false,
      favorites: [],
    },
  }))
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string>('')
  const lastSavedRef = useRef<Record<SportKey, SportConfig> | null>(null)
  const [toast, setToast] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const wnbaConfig = sportConfigs.wnba
  const nhlConfig = sportConfigs.nhl

  const cloneSportConfig = useCallback(
    (config: SportConfig): SportConfig => ({
      ...config,
      favorites: config.favorites.map(f => ({ ...f })),
    }),
    []
  )

  const updateSportConfig = useCallback(
    (sportKey: SportKey, updater: (config: SportConfig) => SportConfig) => {
      setSportConfigs(prev => {
        const current = prev[sportKey]
        const nextConfig = updater(current)
        if (nextConfig === current) return prev
        return { ...prev, [sportKey]: nextConfig }
      })
    },
    []
  )

  // Load initial configuration exactly once to avoid clobbering in-progress edits
  const initRef = useRef(false)
  useEffect(() => {
    if (!initRef.current && initialConfig) {
      const wnbaSport = initialConfig.sports.find(s => s.sport === 'wnba')
      const nhlSport = initialConfig.sports.find(s => s.sport === 'nhl')
      setSportConfigs(prev => {
        const nextConfigs: Record<SportKey, SportConfig> = {
          wnba: wnbaSport ? { ...wnbaSport } : prev.wnba,
          nhl: nhlSport ? { ...nhlSport } : prev.nhl,
        }
        lastSavedRef.current = {
          wnba: cloneSportConfig(nextConfigs.wnba),
          nhl: cloneSportConfig(nextConfigs.nhl),
        }
        return nextConfigs
      })
      initRef.current = true
    }
  }, [initialConfig, cloneSportConfig])

  const orderedConfigs = useMemo(() => [sportConfigs.wnba, sportConfigs.nhl], [sportConfigs])

  // Notify parent of changes
  useEffect(() => {
    onConfigChange({
      sports: orderedConfigs,
    })
  }, [orderedConfigs, onConfigChange])

  const deepEqual = (a: any, b: any): boolean => {
    try {
      return JSON.stringify(a) === JSON.stringify(b)
    } catch {
      return false
    }
  }

  const hasChanges = useMemo(() => {
    const last = lastSavedRef.current
    if (!last) return true
    return !deepEqual(
      {
        w: { e: last.wnba.enabled, f: last.wnba.favorites },
        n: { e: last.nhl.enabled, f: last.nhl.favorites },
      },
      {
        w: { e: sportConfigs.wnba.enabled, f: sportConfigs.wnba.favorites },
        n: { e: sportConfigs.nhl.enabled, f: sportConfigs.nhl.favorites },
      }
    )
  }, [sportConfigs])

  const handleSave = async () => {
    try {
      setSaving(true)
      setSaveMsg('')
      const { data: sess } = await supabase.auth.getSession()
      const jwt = sess.session?.access_token
      if (!jwt) {
        setSaveMsg('Not signed in')
        setToast({ kind: 'error', text: 'Not signed in' })
        setSaving(false)
        return
      }
      // Build payload: identifiers prefer id, then abbr, then name
      const ids = (favs: FavoriteTeam[]) =>
        favs.map(f => String(f.id || f.abbr || f.name)).filter(Boolean)
      const currentWnba = sportConfigs.wnba
      const currentNhl = sportConfigs.nhl
      const payloadConfigs = [
        {
          sport: 'wnba',
          enabled: currentWnba.enabled,
          priority: 1,
          favoriteTeams: ids(currentWnba.favorites),
        },
        {
          sport: 'nhl',
          enabled: currentNhl.enabled,
          priority: 2,
          favoriteTeams: ids(currentNhl.favorites),
        },
      ]
      const resp = await fetch(`/api/device/${deviceId}/sports`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ sportConfigs: payloadConfigs }),
      })
      if (!resp.ok) {
        const txt = await resp.text()
        setSaveMsg(`Save failed: ${txt || resp.status}`)
        setToast({ kind: 'error', text: 'Save failed' })
      } else {
        setSaveMsg('Favorites saved')
        setToast({ kind: 'success', text: 'Favorites saved' })
        // Update lastSaved snapshot
        lastSavedRef.current = {
          wnba: cloneSportConfig(currentWnba),
          nhl: cloneSportConfig(currentNhl),
        }
      }
    } catch (e: any) {
      setSaveMsg(`Save error: ${e.message}`)
      setToast({ kind: 'error', text: 'Save error' })
    } finally {
      setSaving(false)
      // Auto-hide toast
      setTimeout(() => setToast(null), 2500)
    }
  }

  const SportEditor = ({ sportKey }: { sportKey: SportKey }) => {
    const { wnba: wnbaTeams = [], nhl: nhlTeams = [] } = teams
    const config = sportConfigs[sportKey]
    const sportTeams = useMemo(
      () => (sportKey === 'wnba' ? wnbaTeams : nhlTeams),
      [sportKey, wnbaTeams, nhlTeams]
    )
    const sportInfo = SPORT_INFO[sportKey]

    const [newTeam, setNewTeam] = useState({ name: '', abbr: '', id: '' })
    // simple inputs + native datalist for suggestions

    // No quick add; simple manual add with datalist suggestions

    // Auto-fill manual inputs based on lookups (like Legacy Config)
    useEffect(() => {
      // Prefer exact name match (case-insensitive)
      const n = newTeam.name.trim().toLowerCase()
      if (n) {
        const byName = sportTeams.find(t => t.name.toLowerCase() === n)
        if (byName) {
          setNewTeam(prev => ({
            name: byName.name,
            abbr: prev.abbr || byName.abbreviation,
            id: prev.id || String(byName.id),
          }))
          return
        }
      }
      // If abbr filled but name empty, try abbr lookup to fill name/id
      const a = newTeam.abbr.trim().toUpperCase()
      if (a && (!newTeam.name || !newTeam.id)) {
        const byAbbr = sportTeams.find(t => t.abbreviation.toUpperCase() === a)
        if (byAbbr) {
          setNewTeam(prev => ({
            name: prev.name || byAbbr.name,
            abbr: byAbbr.abbreviation,
            id: prev.id || String(byAbbr.id),
          }))
        }
      }
    }, [newTeam.name, newTeam.abbr, newTeam.id, sportTeams])

    const addFavorite = (team?: Team) => {
      const teamToAdd = team || {
        name: newTeam.name.trim(),
        abbreviation: newTeam.abbr.trim().toUpperCase(),
        id: newTeam.id.trim() || undefined,
      }

      if (!teamToAdd.name || !teamToAdd.abbreviation) {
        return
      }

      // Check if already exists
      const exists = config.favorites.some(
        fav => fav.name === teamToAdd.name || fav.abbr === teamToAdd.abbreviation
      )

      if (exists) {
        console.log(`${teamToAdd.name} is already in ${sportKey.toUpperCase()} favorites`)
        return
      }

      const newFavorite: FavoriteTeam = {
        name: teamToAdd.name,
        abbr: teamToAdd.abbreviation,
        id: teamToAdd.id,
      }

      updateSportConfig(sportKey, cfg => ({
        ...cfg,
        favorites: [...cfg.favorites, newFavorite],
      }))

      setNewTeam({ name: '', abbr: '', id: '' })
    }

    const removeFavorite = (index: number) => {
      updateSportConfig(sportKey, cfg => ({
        ...cfg,
        favorites: cfg.favorites.filter((_, i) => i !== index),
      }))
    }

    const moveFavorite = (from: number, to: number) => {
      updateSportConfig(sportKey, cfg => {
        if (to < 0 || to >= cfg.favorites.length || from === to) return cfg
        const next = cfg.favorites.slice()
        const [moved] = next.splice(from, 1)
        next.splice(to, 0, moved)
        return { ...cfg, favorites: next }
      })
    }

    const autoFillTeamIds = () => {
      updateSportConfig(sportKey, cfg => {
        const updatedFavorites = cfg.favorites.map(fav => {
          const matchingTeam = sportTeams.find(
            team =>
              team.abbreviation.toLowerCase() === fav.abbr.toLowerCase() ||
              team.name.toLowerCase() === fav.name.toLowerCase()
          )

          if (matchingTeam) {
            return {
              ...fav,
              id: matchingTeam.id,
              name: matchingTeam.name,
              abbr: matchingTeam.abbreviation,
            }
          }

          return fav
        })

        return { ...cfg, favorites: updatedFavorites }
      })
    }

    // Enrich favorites from team directory on first load or when identifiers look incomplete
    const enrichedOnce = useRef(false)
    useEffect(() => {
      if (!sportTeams.length) return
      // Heuristic: enrich if any favorite is missing id/name/abbr or looks placeholder (name==abbr)
      const needsEnrich = config.favorites.some(
        f =>
          !f.id ||
          !f.name ||
          !f.abbr ||
          (f.name && f.abbr && f.name.toUpperCase() === f.abbr.toUpperCase())
      )
      if (!needsEnrich && enrichedOnce.current) return
      const updated = config.favorites.map(fav => {
        // Match by id first
        let mt = fav.id ? sportTeams.find(t => String(t.id) === String(fav.id)) : undefined
        // Then by abbr
        if (!mt && fav.abbr) {
          mt = sportTeams.find(t => t.abbreviation.toUpperCase() === fav.abbr.toUpperCase())
        }
        // Then by name
        if (!mt && fav.name) {
          mt = sportTeams.find(t => t.name.toLowerCase() === fav.name.toLowerCase())
        }
        if (mt) {
          return { name: mt.name, abbr: mt.abbreviation, id: String(mt.id) }
        }
        return fav
      })
      // Only commit if something changed
      const changed = JSON.stringify(updated) !== JSON.stringify(config.favorites)
      if (changed) {
        setSportConfigs(prev => {
          const current = prev[sportKey]
          if (!current) return prev
          return {
            ...prev,
            [sportKey]: { ...current, favorites: updated },
          }
        })
      }
      enrichedOnce.current = true
    }, [sportTeams, config.favorites, sportKey])

    const toggleEnabled = () => {
      updateSportConfig(sportKey, cfg => ({
        ...cfg,
        enabled: !cfg.enabled,
      }))
    }

    // no custom dropdown; rely on datalist to avoid clipping/stacking issues

    if (loading) {
      return (
        <div className="p-4">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
          </div>
        </div>
      )
    }

    if (error) {
      return (
        <div className="p-4">
          <div className="text-red-600 text-sm">
            Error loading {sportInfo.name} teams: {error}
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        {/* Sport Header with Toggle */}
        <Card className={config.enabled ? 'ring-2 ring-blue-200' : 'bg-gray-50'}>
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{sportInfo.icon}</span>
                <div>
                  <h3 className="text-lg font-semibold">{sportInfo.name} Favorites</h3>
                  <p className="text-sm text-gray-600">{sportInfo.description}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Badge variant={config.enabled ? 'success' : 'default'}>
                  {config.favorites.length} teams
                </Badge>
                <Button
                  onClick={toggleEnabled}
                  variant={config.enabled ? 'success' : 'secondary'}
                  size="sm"
                >
                  {config.enabled ? 'Enabled' : 'Enable'}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Favorites List */}
        {config.enabled && (
          <Card>
            <div className="p-4 relative">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium">Current {sportInfo.name} Favorites</h4>
                <Button
                  onClick={autoFillTeamIds}
                  variant="ghost"
                  size="sm"
                  disabled={config.favorites.length === 0}
                >
                  Auto-fill Team IDs
                </Button>
              </div>

              {config.favorites.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-lg mb-2">{sportInfo.icon}</div>
                  <p>No {sportInfo.name} favorites configured</p>
                  <p className="text-sm">Add teams below to prioritize their games</p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {config.favorites.map((fav, index) => (
                    <li
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700"
                    >
                      <div className="flex items-center space-x-3">
                        <Badge variant="info" size="sm">
                          {fav.abbr}
                        </Badge>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-gray-100">
                            {fav.name}
                          </div>
                          {fav.id && (
                            <div className="text-xs text-gray-500 dark:text-gray-300">
                              ID: {fav.id}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          onClick={() => moveFavorite(index, index - 1)}
                          variant="secondary"
                          size="sm"
                          disabled={index === 0}
                          aria-label="Move up"
                          title="Move up"
                        >
                          ▲
                        </Button>
                        <Button
                          onClick={() => moveFavorite(index, index + 1)}
                          variant="secondary"
                          size="sm"
                          disabled={index === config.favorites.length - 1}
                          aria-label="Move down"
                          title="Move down"
                        >
                          ▼
                        </Button>
                        <Button
                          onClick={() => removeFavorite(index)}
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                        >
                          Remove
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        )}

        {/* Add New Team */}
        {config.enabled && (
          <Card>
            <div className="p-4">
              <h4 className="font-medium mb-3">Add {sportInfo.name} Team</h4>
              {/* Add */}
              <div className="border-t pt-4">
                <h5 className="text-sm font-medium text-gray-700 mb-2">Add:</h5>
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-5">
                    <Input
                      value={newTeam.name}
                      onChange={e => setNewTeam({ ...newTeam, name: e.target.value })}
                      placeholder="Team name"
                      list={`${sportKey}-name-list`}
                    />
                    <datalist id={`${sportKey}-name-list`}>
                      {sportTeams.slice(0, 50).map(t => (
                        <option key={`name-opt-${t.id}`} value={t.name}>
                          {t.abbreviation}
                        </option>
                      ))}
                    </datalist>
                  </div>
                  <div className="col-span-2">
                    <Input
                      value={newTeam.abbr}
                      onChange={e => setNewTeam({ ...newTeam, abbr: e.target.value.toUpperCase() })}
                      placeholder="ABR"
                      className="text-center"
                      list={`${sportKey}-abbr-list`}
                    />
                    <datalist id={`${sportKey}-abbr-list`}>
                      {sportTeams.slice(0, 50).map(t => (
                        <option key={`abbr-opt-${t.id}`} value={t.abbreviation}>
                          {t.name}
                        </option>
                      ))}
                    </datalist>
                  </div>
                  <div className="col-span-3">
                    <Input
                      value={newTeam.id}
                      onChange={e => setNewTeam({ ...newTeam, id: e.target.value })}
                      placeholder="Team ID"
                    />
                  </div>
                  <div className="col-span-2">
                    <Button
                      onClick={() => addFavorite()}
                      disabled={!newTeam.name || !newTeam.abbr}
                      size="sm"
                      className="w-full"
                    >
                      Add
                    </Button>
                  </div>
                </div>
              </div>
              {/* Suggestions provided via native datalist */}
            </div>
          </Card>
        )}
      </div>
    )
  }

  if (loading) {
    return (
      <Card>
        <div className="p-4">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </div>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Multi-Sport Favorites Configuration</h3>
              <p className="text-sm text-gray-600">
                Configure favorite teams separately for each sport to avoid conflicts
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Badge
                variant={wnbaConfig.enabled ? 'success' : 'default'}
                className={SPORT_INFO.wnba.color}
              >
                🏀 {wnbaConfig.favorites.length} WNBA
              </Badge>
              <Badge
                variant={nhlConfig.enabled ? 'success' : 'default'}
                className={SPORT_INFO.nhl.color}
              >
                🏒 {nhlConfig.favorites.length} NHL
              </Badge>
              <Button size="sm" onClick={handleSave} disabled={saving || !hasChanges}>
                {saving ? 'Saving…' : 'Save Favorites'}
              </Button>
            </div>
          </div>
          {saveMsg && <div className="mt-2 text-xs text-gray-600">{saveMsg}</div>}
        </div>
      </Card>

      {toast && (
        <div
          className={`fixed bottom-4 right-4 px-3 py-2 rounded-md shadow-lg text-sm ${
            toast.kind === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}
          role="status"
        >
          {toast.text}
        </div>
      )}

      {/* Sport-Specific Tabs */}
      <Tabs defaultValue="wnba" className="w-full">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="wnba" className="flex items-center space-x-2">
            <span>🏀</span>
            <span>WNBA</span>
            {wnbaConfig.favorites.length > 0 && (
              <Badge variant="success" size="sm">
                {wnbaConfig.favorites.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="nhl" className="flex items-center space-x-2">
            <span>🏒</span>
            <span>NHL</span>
            {nhlConfig.favorites.length > 0 && (
              <Badge variant="success" size="sm">
                {nhlConfig.favorites.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="wnba" className="space-y-4">
          <SportEditor sportKey="wnba" />
        </TabsContent>

        <TabsContent value="nhl" className="space-y-4">
          <SportEditor sportKey="nhl" />
        </TabsContent>
      </Tabs>

      {/* Configuration Preview */}
      <Card className="bg-blue-50 border-blue-200">
        <div className="p-4">
          <h4 className="font-medium text-blue-900 mb-2">Configuration Summary</h4>
          <div className="space-y-1 text-sm">
            <div className="flex items-center space-x-2">
              <span>🏀</span>
              <span className={wnbaConfig.enabled ? 'font-medium' : 'text-gray-500'}>
                WNBA {wnbaConfig.enabled ? 'Enabled' : 'Disabled'}:
              </span>
              <span>{wnbaConfig.favorites.map(f => f.abbr).join(', ') || 'None'}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span>🏒</span>
              <span className={nhlConfig.enabled ? 'font-medium' : 'text-gray-500'}>
                NHL {nhlConfig.enabled ? 'Enabled' : 'Disabled'}:
              </span>
              <span>{nhlConfig.favorites.map(f => f.abbr).join(', ') || 'None'}</span>
            </div>
          </div>
          <div className="mt-3 p-2 bg-blue-100 rounded text-xs text-blue-700">
            <strong>Priority:</strong> WNBA games take priority over NHL games when both sports have
            active games involving your favorite teams.
          </div>
        </div>
      </Card>

      {/* JSON Export */}
      <Card>
        <div className="p-4">
          <h4 className="font-medium mb-2 text-gray-900 dark:text-gray-100">
            Export Configuration
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
            Use this JSON in your multi-sport configuration file:
          </p>
          <pre className="bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-200 dark:border-gray-600 p-3 rounded text-xs overflow-x-auto">
            {JSON.stringify(
              {
                sports: [
                  {
                    sport: 'wnba',
                    enabled: wnbaConfig.enabled,
                    priority: 1,
                    favorites: wnbaConfig.favorites,
                  },
                  {
                    sport: 'nhl',
                    enabled: nhlConfig.enabled,
                    priority: 2,
                    favorites: nhlConfig.favorites,
                  },
                ],
              },
              null,
              2
            )}
          </pre>
        </div>
      </Card>
    </div>
  )
}
