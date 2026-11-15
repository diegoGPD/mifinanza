async function req(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  })
  let data = null
  try { data = await res.json() } catch {}
  if (!res.ok) {
    const err = new Error(data?.error || `Error ${res.status}`)
    err.status = res.status
    throw err
  }
  return data
}

export const api = {
  get: (u) => req('GET', u),
  post: (u, b) => req('POST', u, b),
  put: (u, b) => req('PUT', u, b),
  del: (u) => req('DELETE', u),
}
