# Server-Side Preview Rendering

This directory contains the **server-side** preview generation implementation using node-canvas.

## ⚠️ Deployment Compatibility

**This code DOES NOT work on Vercel** (or other serverless platforms) because it requires Cairo native libraries.

### Where This Works
- ✅ Railway
- ✅ Render
- ✅ DigitalOcean App Platform
- ✅ Any VM-based hosting
- ✅ Local development (with Cairo installed)

### Where This DOES NOT Work
- ❌ Vercel (serverless)
- ❌ Netlify Functions (serverless)
- ❌ AWS Lambda (without custom layer)
- ❌ Any serverless platform without native dependencies

## Client-Side Alternative

For Vercel and other serverless platforms, use the **client-side** implementation in `../client-preview/`.

The client-side version:
- Uses browser Canvas API (HTMLCanvasElement)
- No server-side rendering required
- Works on any hosting platform
- Same visual output as server-side

## When to Use Each

### Use Server-Side (`canvas/`)
- Generating preview images for email/notifications
- Batch processing multiple previews
- Deploying to Railway/Render/VM-based hosting

### Use Client-Side (`client-preview/`)
- Web admin preview feature (current implementation)
- Deploying to Vercel or serverless platforms
- Real-time interactive previews

## API Endpoint

The `/api/device/[id]/preview-ts` endpoint uses this server-side implementation.

**Note:** This endpoint is kept for potential future use on Railway/Render deployments, but is **not used** by the web admin when deployed to Vercel.

## Migration

The web admin has been migrated to client-side rendering. If you need to switch back to server-side (e.g., deploying to Railway), update `DisplayPreview.tsx` to call the API endpoint instead of using `ClientPreviewGenerator`.
