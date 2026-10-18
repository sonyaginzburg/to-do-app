export type FieldErrors = Record<string, string>

export class ApiError extends Error {
  status: number
  code: string
  fields: FieldErrors

  constructor(status: number, code: string, message: string, fields: FieldErrors = {}) {
    super(message)
    this.status = status
    this.code = code
    this.fields = fields
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'

// Calls the JSON API. Cookies are sent so the login session works, and every failure
// (including "server unreachable") becomes an ApiError the screens can show.
export async function api<T = void>(method: Method, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'include',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'NETWORK', 'Cannot reach the server. Check your connection.')
  }

  if (res.status === 204) return undefined as T

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const err = data?.error
    throw new ApiError(
      res.status,
      err?.code ?? 'UNKNOWN',
      err?.message ?? 'Something went wrong',
      err?.fields ?? {},
    )
  }
  return data as T
}
