/** Serves plotline.fit: www goes to the apex, everything else comes from the built site (wrangler.jsonc). */
type Env = { ASSETS: { fetch(request: Request): Promise<Response> } }

const apex = 'plotline.fit'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.hostname === `www.${apex}`) {
      return Response.redirect(`https://${apex}${url.pathname}${url.search}`, 301)
    }
    return env.ASSETS.fetch(request)
  },
}
