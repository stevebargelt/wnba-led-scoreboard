import { createClient } from '@supabase/supabase-js'
import type { NextApiRequest, NextApiResponse } from 'next'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Parse admin emails from environment
const adminEmails = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

export interface AuthenticatedUser {
  id: string
  email?: string
  role?: string
}

export interface AuthResult {
  authenticated: boolean
  user?: AuthenticatedUser
  error?: string
}

/**
 * Verify authentication and optionally check admin status
 * @param req - NextJS API request
 * @param requireAdmin - Whether to require admin access (checks ADMIN_EMAILS env)
 * @returns Authentication result with user info or error
 */
export async function verifyAuth(
  req: NextApiRequest,
  requireAdmin: boolean = false
): Promise<AuthResult> {
  // Check for service key
  if (!supabaseUrl || !serviceKey) {
    return {
      authenticated: false,
      error: 'Server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY',
    }
  }

  // Extract token from Authorization header
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      authenticated: false,
      error: 'Missing or invalid Authorization header',
    }
  }

  const token = authHeader.split(' ')[1]
  if (!token) {
    return {
      authenticated: false,
      error: 'Missing Authorization token',
    }
  }

  try {
    // Create admin client with service role key
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Verify the user token
    const {
      data: { user },
      error: userErr,
    } = await admin.auth.getUser(token)

    if (userErr || !user) {
      return {
        authenticated: false,
        error: 'Invalid auth token',
      }
    }

    // Check admin requirement if specified
    if (requireAdmin) {
      // If admin is required but no admin emails are configured, deny access
      if (adminEmails.length === 0) {
        return {
          authenticated: false,
          error: 'Admin access not configured - no admin emails specified',
        }
      }

      // Check if user is in admin list
      if (!user.email || !adminEmails.includes(user.email)) {
        return {
          authenticated: false,
          error: 'Admin access required',
        }
      }
    }

    return {
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    }
  } catch (error) {
    console.error('Auth verification error:', error)
    return {
      authenticated: false,
      error: 'Authentication verification failed',
    }
  }
}

/**
 * Middleware helper to protect API routes
 * @param handler - The API route handler
 * @param requireAdmin - Whether to require admin access
 * @returns Wrapped handler with authentication
 */
export function withAuth(
  handler: (
    req: NextApiRequest,
    res: NextApiResponse,
    user: AuthenticatedUser
  ) => Promise<void> | void,
  requireAdmin: boolean = false
) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const authResult = await verifyAuth(req, requireAdmin)

    if (!authResult.authenticated) {
      const statusCode = authResult.error === 'Admin access required' ? 403 : 401
      return res.status(statusCode).json({ error: authResult.error })
    }

    return handler(req, res, authResult.user!)
  }
}

/**
 * Get the Supabase admin client for server-side operations
 * @returns Supabase client with service role key
 */
export function getAdminClient() {
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Server misconfigured: missing Supabase credentials')
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
