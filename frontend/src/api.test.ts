import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from './api'

afterEach(() => vi.unstubAllGlobals())

const stub = (res: Response | Error) =>
  vi.stubGlobal(
    'fetch',
    res instanceof Error ? vi.fn().mockRejectedValue(res) : vi.fn().mockResolvedValue(res),
  )

describe('api client', () => {
  it('sends cookies and a JSON body', async () => {
    stub(new Response(JSON.stringify({ ok: 1 }), { status: 200 }))

    expect(await api('POST', '/x', { a: 1 })).toEqual({ ok: 1 })

    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('/api/x')
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'include',
      body: '{"a":1}',
      headers: { 'Content-Type': 'application/json' },
    })
  })

  it('returns undefined for 204 No Content', async () => {
    stub(new Response(null, { status: 204 }))
    expect(await api('DELETE', '/x')).toBeUndefined()
  })

  it('turns the standard error format into an ApiError', async () => {
    stub(
      new Response(
        JSON.stringify({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid input', fields: { a: 'bad' } },
        }),
        { status: 400 },
      ),
    )

    const err = await api('POST', '/x').catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 400, code: 'VALIDATION_ERROR', fields: { a: 'bad' } })
  })

  it('handles an error response that is not JSON', async () => {
    stub(new Response('<html>Bad gateway</html>', { status: 502 }))

    const err = await api('GET', '/x').catch((e) => e)
    expect(err).toMatchObject({ status: 502, code: 'UNKNOWN', message: 'Something went wrong' })
  })

  it('turns a network failure into an ApiError with status 0', async () => {
    stub(new TypeError('Failed to fetch'))

    const err = await api('GET', '/x').catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(0)
  })
})
