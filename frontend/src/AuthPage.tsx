import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, type FieldErrors } from './api'
import { useLogin, useRegister } from './auth'
import styles from './AuthPage.module.css'

type Mode = 'login' | 'register'

const COPY = {
  login: {
    heading: 'Log in',
    submit: 'Log in',
    busy: 'Logging in…',
    switchText: 'New here?',
    switchLink: 'Create an account',
    switchTo: '/register',
  },
  register: {
    heading: 'Create your account',
    submit: 'Create account',
    busy: 'Creating account…',
    switchText: 'Already have an account?',
    switchLink: 'Log in',
    switchTo: '/login',
  },
} as const

// Turns an API failure into messages for the email field, the password field, or the whole form.
function explain(err: unknown, mode: Mode): { fields: FieldErrors; form?: string } {
  if (!(err instanceof ApiError)) return { fields: {}, form: 'Something went wrong. Try again.' }
  if (err.status === 400) return { fields: err.fields }
  if (err.status === 409) return { fields: { email: 'Email already in use' } }
  if (err.status === 401 && mode === 'login') {
    return { fields: {}, form: 'Invalid email or password' }
  }
  if (err.status === 429) {
    return { fields: {}, form: 'Too many attempts. Please wait a minute and try again.' }
  }
  return { fields: {}, form: err.message }
}

export default function AuthPage({ mode }: { mode: Mode }) {
  const copy = COPY[mode]
  const login = useLogin()
  const register = useRegister()
  const mutation = mode === 'login' ? login : register

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const { fields, form } = mutation.error
    ? explain(mutation.error, mode)
    : { fields: {} as FieldErrors, form: undefined }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    mutation.mutate({ email, password })
  }

  return (
    <main className={styles.page}>
      <section className={styles.sheet}>
        <h1 className={styles.title}>To-do planner</h1>
        <h2 className={styles.heading}>{copy.heading}</h2>

        <form onSubmit={onSubmit} noValidate className={styles.form}>
          {form && (
            <p role="alert" className={styles.formError}>
              {form}
            </p>
          )}

          <div className={styles.field}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={fields.email ? true : undefined}
              aria-describedby={fields.email ? 'email-error' : undefined}
            />
            {fields.email && (
              <p id="email-error" role="alert" className={styles.error}>
                {fields.email}
              </p>
            )}
          </div>

          <div className={styles.field}>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={fields.password ? true : undefined}
              aria-describedby={fields.password ? 'password-error' : undefined}
            />
            {fields.password && (
              <p id="password-error" role="alert" className={styles.error}>
                {fields.password}
              </p>
            )}
            {mode === 'register' && !fields.password && (
              <p className={styles.hint}>At least 8 characters.</p>
            )}
          </div>

          <button type="submit" className={styles.submit} disabled={mutation.isPending}>
            {mutation.isPending ? copy.busy : copy.submit}
          </button>
        </form>

        <p className={styles.switch}>
          {copy.switchText} <Link to={copy.switchTo}>{copy.switchLink}</Link>
        </p>
      </section>
    </main>
  )
}
