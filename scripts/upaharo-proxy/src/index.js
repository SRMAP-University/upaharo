export default {
  async fetch(request, env) {
    const incoming = new URL(request.url)
    const originHost = env.ORIGIN_HOST || '3.111.32.194'
    const originPort = env.ORIGIN_PORT || '80'
    const target = new URL(`http://${incoming.host}:${originPort}${incoming.pathname}${incoming.search}`)

    const headers = new Headers(request.headers)
    headers.set('Host', incoming.host)
    headers.set('X-Forwarded-Host', incoming.host)
    headers.set('X-Forwarded-Proto', 'https')
    headers.set('X-Real-IP', request.headers.get('CF-Connecting-IP') || '')

    return fetch(
      new Request(target.toString(), {
        method: request.method,
        headers,
        body: request.body,
        redirect: 'manual',
        cf: { resolveOverride: originHost },
      })
    ).then((response) => {
      const next = new Response(response.body, response)
      next.headers.set('X-Upaharo-Proxy', '1')
      return next
    })
  },
}
