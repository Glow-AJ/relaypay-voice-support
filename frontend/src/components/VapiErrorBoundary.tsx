'use client'

import { Component, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
}

export class VapiErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.error('[VapiErrorBoundary]', error)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex flex-col items-center gap-2 py-8">
          <p className="text-sm" style={{ color: '#6B7280' }}>
            Voice unavailable. Please type your question below.
          </p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="text-xs underline"
            style={{ color: '#1B3A7A' }}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
