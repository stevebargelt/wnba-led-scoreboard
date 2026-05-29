import type { NextApiRequest, NextApiResponse } from 'next'
import { verifyAuth } from '@/lib/auth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // First check if authenticated at all
  const authResult = await verifyAuth(req, false)
  if (!authResult.authenticated) {
    return res.status(200).json({ isAdmin: false })
  }

  // Then check admin status
  const adminResult = await verifyAuth(req, true)
  return res.status(200).json({ isAdmin: adminResult.authenticated })
}
