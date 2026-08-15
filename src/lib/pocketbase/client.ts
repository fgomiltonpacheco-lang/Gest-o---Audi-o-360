import PocketBase from 'pocketbase'

// On Skip Cloud the PocketBase API is served from the same origin as the app,
// so we prefer a same-origin base (relative "/"). The explicit env var is an
// internal URL used during builds/deploy and is NOT reachable from the browser.
function resolveBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  const envUrl = import.meta.env.VITE_POCKETBASE_URL as string | undefined
  if (envUrl) return envUrl
  return '/'
}

const pb = new PocketBase(resolveBaseUrl())
pb.autoCancellation(false)

export default pb
