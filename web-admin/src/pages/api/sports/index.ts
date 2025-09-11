import { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '@/lib/supabaseClient'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    try {
      // For development, return mock team data for both sports
      console.log('[DEV] Returning mock sports team data')
      
      const mockSportData = {
        wnba: [
          { id: '18', name: 'Seattle Storm', abbreviation: 'SEA', conference: 'Western', division: 'Western' },
          { id: '26', name: 'Las Vegas Aces', abbreviation: 'LVA', conference: 'Western', division: 'Western' },
          { id: 'MIN', name: 'Minnesota Lynx', abbreviation: 'MIN', conference: 'Western', division: 'Western' },
          { id: 'CHI', name: 'Chicago Sky', abbreviation: 'CHI', conference: 'Eastern', division: 'Eastern' },
          { id: 'ATL', name: 'Atlanta Dream', abbreviation: 'ATL', conference: 'Eastern', division: 'Eastern' },
          { id: 'CON', name: 'Connecticut Sun', abbreviation: 'CON', conference: 'Eastern', division: 'Eastern' },
          { id: 'DAL', name: 'Dallas Wings', abbreviation: 'DAL', conference: 'Western', division: 'Western' },
          { id: 'IND', name: 'Indiana Fever', abbreviation: 'IND', conference: 'Eastern', division: 'Eastern' },
          { id: 'NYL', name: 'New York Liberty', abbreviation: 'NYL', conference: 'Eastern', division: 'Eastern' },
          { id: 'PHX', name: 'Phoenix Mercury', abbreviation: 'PHX', conference: 'Western', division: 'Western' },
          { id: 'WAS', name: 'Washington Mystics', abbreviation: 'WAS', conference: 'Eastern', division: 'Eastern' },
          { id: 'LAS', name: 'Los Angeles Sparks', abbreviation: 'LAS', conference: 'Western', division: 'Western' }
        ],
        nhl: [
          { id: '25', name: 'Seattle Kraken', abbreviation: 'SEA', conference: 'Western', division: 'Pacific' },
          { id: '54', name: 'Vegas Golden Knights', abbreviation: 'VGK', conference: 'Western', division: 'Pacific' },
          { id: '15', name: 'Minnesota Wild', abbreviation: 'MIN', conference: 'Western', division: 'Central' },
          { id: '6', name: 'Boston Bruins', abbreviation: 'BOS', conference: 'Eastern', division: 'Atlantic' },
          { id: '3', name: 'New York Rangers', abbreviation: 'NYR', conference: 'Eastern', division: 'Atlantic' },
          { id: '8', name: 'Toronto Maple Leafs', abbreviation: 'TOR', conference: 'Eastern', division: 'Atlantic' },
          { id: '13', name: 'Colorado Avalanche', abbreviation: 'COL', conference: 'Western', division: 'Central' },
          { id: '14', name: 'Dallas Stars', abbreviation: 'DAL', conference: 'Western', division: 'Central' },
          { id: '29', name: 'Tampa Bay Lightning', abbreviation: 'TBL', conference: 'Eastern', division: 'Atlantic' },
          { id: '28', name: 'Florida Panthers', abbreviation: 'FLA', conference: 'Eastern', division: 'Atlantic' },
          { id: '22', name: 'Edmonton Oilers', abbreviation: 'EDM', conference: 'Western', division: 'Pacific' },
          { id: '23', name: 'Los Angeles Kings', abbreviation: 'LAK', conference: 'Western', division: 'Pacific' },
          { id: '20', name: 'Anaheim Ducks', abbreviation: 'ANA', conference: 'Western', division: 'Pacific' },
          { id: '21', name: 'Calgary Flames', abbreviation: 'CGY', conference: 'Western', division: 'Pacific' },
          { id: '26', name: 'Vancouver Canucks', abbreviation: 'VAN', conference: 'Western', division: 'Pacific' },
          { id: '24', name: 'San Jose Sharks', abbreviation: 'SJS', conference: 'Western', division: 'Pacific' }
        ]
      }

      res.status(200).json({ sports: mockSportData })
    } catch (error) {
      console.error('API error:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  } else {
    res.setHeader('Allow', ['GET'])
    res.status(405).json({ error: `Method ${req.method} not allowed` })
  }
}
