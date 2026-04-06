import { registerFont } from 'canvas'
import { readFileSync } from 'fs'
import { join } from 'path'

interface FontConfig {
  font: string
  size: number
}

interface FontsConfig {
  [key: string]: FontConfig
}

export class FontManager {
  private configPath: string
  private fontDir: string
  private config: FontsConfig
  private registeredFonts: Set<string>
  private fontCache: Map<string, string>

  constructor(configPath: string = 'config/fonts.json', fontDir: string = 'assets/fonts/pixel') {
    this.configPath = configPath
    this.fontDir = fontDir
    this.registeredFonts = new Set()
    this.fontCache = new Map()
    this.config = this.loadConfig()
    this.registerAllFonts()
  }

  private loadConfig(): FontsConfig {
    try {
      const configData = readFileSync(this.configPath, 'utf-8')
      return JSON.parse(configData) as FontsConfig
    } catch (e) {
      console.error(`[FontManager] Failed to load font config: ${e}`)
      return {
        default: { font: '04B_24__.TTF', size: 8 },
        period: { font: '04B_24__.TTF', size: 8 },
        clock: { font: '04B_24__.TTF', size: 8 },
        score: { font: 'score_large.otf', size: 16 },
      }
    }
  }

  private registerAllFonts(): void {
    const uniqueFonts = new Set<string>()
    for (const fontConfig of Object.values(this.config)) {
      uniqueFonts.add(fontConfig.font)
    }

    for (const fontFile of uniqueFonts) {
      this.registerFont(fontFile)
    }
  }

  private registerFont(fontFile: string): void {
    if (this.registeredFonts.has(fontFile)) {
      return
    }

    const fontPath = join(this.fontDir, fontFile)
    try {
      const fontFamily = fontFile.replace(/\.(ttf|otf|TTF|OTF)$/i, '')
      registerFont(fontPath, { family: fontFamily })
      this.registeredFonts.add(fontFile)
    } catch (e) {
      console.error(`[FontManager] Failed to register font ${fontPath}: ${e}`)
    }
  }

  getFont(name: string = 'default'): string {
    const cacheKey = name
    if (this.fontCache.has(cacheKey)) {
      return this.fontCache.get(cacheKey)!
    }

    const fontConfig = this.config[name] || this.config['default']
    if (!fontConfig) {
      console.error(`[FontManager] No configuration for font '${name}'`)
      return '8px monospace'
    }

    const fontFamily = fontConfig.font.replace(/\.(ttf|otf|TTF|OTF)$/i, '')
    const fontString = `${fontConfig.size}px '${fontFamily}'`
    this.fontCache.set(cacheKey, fontString)
    return fontString
  }

  getPeriodFont(): string {
    return this.getFont('period')
  }

  getClockFont(): string {
    return this.getFont('clock')
  }

  getScoreFont(): string {
    return this.getFont('score')
  }

  getDefaultFont(): string {
    return this.getFont('default')
  }

  getSmallFont(): string {
    return this.getFont('small')
  }

  getMediumFont(): string {
    return this.getFont('medium')
  }

  getLargeFont(): string {
    return this.getFont('large')
  }

  getTeamNameFont(): string {
    return this.getFont('team_name')
  }

  getScoreLargeFont(): string {
    return this.getFont('score_large')
  }
}

let fontManagerInstance: FontManager | null = null

export function getFontManager(): FontManager {
  if (fontManagerInstance === null) {
    fontManagerInstance = new FontManager()
  }
  return fontManagerInstance
}
