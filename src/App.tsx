import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ComponentType, FormEvent } from 'react'
import {
  ArrowUp,
  Bot,
  CheckCircle2,
  ChevronDown,
  Code2,
  Copy,
  Database,
  KeyRound,
  LayoutDashboard,
  Loader2,
  MessageSquare,
  PanelLeft,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'
import './App.css'
import { supabase, supabasePublishableKey, supabaseUrl } from './lib/supabase'
import type { AiModel, ChatResult, ProviderUrl, TokenSlot } from './types'

const providers = ['nvidia', 'openrouter'] as const
type ProviderKey = (typeof providers)[number]

const defaultModelForm = {
  priority: 1,
  name: '',
  provider: 'nvidia',
  active: true,
  max_tokens_limit: 4096,
  notes: '',
}

const defaultTokenForm = {
  priority: 1,
  display_name: '',
  secret_name: '',
  provider: 'nvidia',
  active: true,
}

type PageKey = 'overview' | 'chat' | 'models' | 'tokens' | 'curl'

type NavItem = {
  key: PageKey
  label: string
  description: string
  icon: ComponentType<{ size?: number }>
}

const navItems: NavItem[] = [
  {
    key: 'overview',
    label: 'Overview',
    description: 'Health and routing',
    icon: LayoutDashboard,
  },
  {
    key: 'chat',
    label: 'Chat',
    description: 'Test the Edge API',
    icon: MessageSquare,
  },
  {
    key: 'models',
    label: 'Models',
    description: 'Priority failover list',
    icon: Database,
  },
  {
    key: 'tokens',
    label: 'Tokens',
    description: 'Secret slot routing',
    icon: KeyRound,
  },
  {
    key: 'curl',
    label: 'Curl',
    description: 'Copy working request',
    icon: Code2,
  },
]

function App() {
  const [activePage, setActivePage] = useState<PageKey>('chat')
  const [selectedProvider, setSelectedProvider] = useState<ProviderKey>('nvidia')
  const [models, setModels] = useState<AiModel[]>([])
  const [tokenSlots, setTokenSlots] = useState<TokenSlot[]>([])
  const [providerUrls, setProviderUrls] = useState<ProviderUrl[]>([])
  const [selectedModelId, setSelectedModelId] = useState('')
  const [selectedTokenSlotId, setSelectedTokenSlotId] = useState('')
  const [prompt, setPrompt] = useState('give roadmap for java developer')
  const [temperature, setTemperature] = useState(0.2)
  const [topP, setTopP] = useState(0.7)
  const [maxTokens, setMaxTokens] = useState(1024)
  const [modelForm, setModelForm] = useState(defaultModelForm)
  const [tokenForm, setTokenForm] = useState(defaultTokenForm)
  const [result, setResult] = useState<ChatResult | null>(null)
  const [submittedPrompt, setSubmittedPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const functionUrl = `${supabaseUrl}/functions/v1/ai-chat`

  const providerModels = useMemo(
    () => models.filter((model) => model.provider === selectedProvider),
    [models, selectedProvider],
  )

  const providerTokenSlots = useMemo(
    () => tokenSlots.filter((slot) => slot.provider === selectedProvider),
    [selectedProvider, tokenSlots],
  )

  const activeModels = providerModels.filter((model) => model.active)
  const activeTokens = providerTokenSlots.filter((slot) => slot.active)
  const currentPage = navItems.find((item) => item.key === activePage) ?? navItems[0]
  const selectedProviderUrl = providerUrls.find(
    (providerUrl) => providerUrl.provider === selectedProvider,
  )

  const createCurlCommand = useCallback(
    (provider: ProviderKey) => {
      const firstModel = models.find((model) => model.provider === provider)
      const firstTokenSlot = tokenSlots.find((slot) => slot.provider === provider)
      const modelId =
        provider === selectedProvider ? selectedModelId || firstModel?.id : firstModel?.id
      const tokenSlotId =
        provider === selectedProvider
          ? selectedTokenSlotId || firstTokenSlot?.id
          : firstTokenSlot?.id
      const payload = {
        provider,
        modelId: modelId || '<model-id>',
        tokenSlotId: tokenSlotId || '<token-slot-id>',
        prompt,
        temperature,
        top_p: topP,
      max_tokens: maxTokens,
      attempt_timeout_ms: 10000,
      stream: false,
      }

      return `curl --location '${functionUrl}' \\
--header 'Content-Type: application/json' \\
--header 'apikey: ${supabasePublishableKey}' \\
--header 'Authorization: Bearer ${supabasePublishableKey}' \\
--data '${JSON.stringify(payload, null, 2)}'`
    },
    [
      functionUrl,
      maxTokens,
      models,
      prompt,
      selectedModelId,
      selectedProvider,
      selectedTokenSlotId,
      temperature,
      tokenSlots,
      topP,
    ],
  )

  const curlCommand = useMemo(() => {
    return createCurlCommand(selectedProvider)
  }, [
    createCurlCommand,
    selectedProvider,
  ])

  const nvidiaCurlCommand = useMemo(() => {
    return createCurlCommand('nvidia')
  }, [
    createCurlCommand,
  ])

  const openRouterCurlCommand = useMemo(() => {
    return createCurlCommand('openrouter')
  }, [
    createCurlCommand,
  ])

  const loadData = useCallback(async () => {
    setError('')

    const [
      { data: modelRows, error: modelError },
      { data: tokenRows, error: tokenError },
      { data: providerUrlRows, error: providerUrlError },
    ] = await Promise.all([
        supabase
          .from('ai_api_models')
          .select('id, priority, name, provider, active, max_tokens_limit, notes')
          .order('priority', { ascending: true }),
        supabase
          .from('ai_api_token_slots')
          .select('id, priority, display_name, secret_name, provider, active')
          .order('priority', { ascending: true }),
        supabase
          .from('ai_api_provider_urls')
          .select('id, provider, chat_completions_url, active')
          .order('provider', { ascending: true }),
      ])

    if (modelError || tokenError || providerUrlError) {
      setError(
        modelError?.message ??
          tokenError?.message ??
          providerUrlError?.message ??
          'Failed to load data',
      )
      return
    }

    const nextModels = (modelRows ?? []) as AiModel[]
    const nextTokenSlots = (tokenRows ?? []) as TokenSlot[]
    const nextProviderUrls = (providerUrlRows ?? []) as ProviderUrl[]
    setModels(nextModels)
    setTokenSlots(nextTokenSlots)
    setProviderUrls(nextProviderUrls)
    setSelectedModelId((current) => {
      const currentModel = nextModels.find((model) => model.id === current)
      return currentModel?.provider === selectedProvider
        ? current
        : nextModels.find((model) => model.provider === selectedProvider)?.id || ''
    })
    setSelectedTokenSlotId((current) => {
      const currentSlot = nextTokenSlots.find((slot) => slot.id === current)
      return currentSlot?.provider === selectedProvider
        ? current
        : nextTokenSlots.find((slot) => slot.provider === selectedProvider)?.id || ''
    })
    setModelForm((current) => ({ ...current, priority: nextModels.length + 1 }))
    setTokenForm((current) => ({ ...current, priority: nextTokenSlots.length + 1 }))
  }, [selectedProvider])

  useEffect(() => {
    // Initial remote sync for the console tables.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData()
  }, [loadData])

  const runChat = async (event: FormEvent) => {
    event.preventDefault()
    const outgoingPrompt = prompt.trim()
    if (!outgoingPrompt || loading) return

    setLoading(true)
    setError('')
    setResult(null)
    setSubmittedPrompt(outgoingPrompt)
    setPrompt('')

    try {
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabasePublishableKey,
          Authorization: `Bearer ${supabasePublishableKey}`,
        },
        body: JSON.stringify({
          modelId: selectedModelId,
          provider: selectedProvider,
          tokenSlotId: selectedTokenSlotId,
          prompt: outgoingPrompt,
          temperature,
          top_p: topP,
          max_tokens: maxTokens,
          attempt_timeout_ms: 10000,
          stream: false,
        }),
      })

      const json = (await response.json()) as ChatResult
      setResult(json)

      if (!response.ok) {
        setError(json.error ?? 'Edge Function request failed')
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  const handlePromptKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
    }
  }

  const saveModel = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    const { error: saveError } = await supabase.from('ai_api_models').insert({
      ...modelForm,
      provider: selectedProvider,
      notes: modelForm.notes || null,
    })

    if (saveError) {
      setError(saveError.message)
    } else {
      setModelForm({
        ...defaultModelForm,
        provider: selectedProvider,
        priority: providerModels.length + 2,
      })
      await loadData()
    }

    setSaving(false)
  }

  const saveTokenSlot = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')

    const { error: saveError } = await supabase
      .from('ai_api_token_slots')
      .insert({ ...tokenForm, provider: selectedProvider })

    if (saveError) {
      setError(saveError.message)
    } else {
      setTokenForm({
        ...defaultTokenForm,
        provider: selectedProvider,
        priority: providerTokenSlots.length + 2,
      })
      await loadData()
    }

    setSaving(false)
  }

  const toggleModel = async (model: AiModel) => {
    const { error: updateError } = await supabase
      .from('ai_api_models')
      .update({ active: !model.active })
      .eq('id', model.id)

    if (updateError) setError(updateError.message)
    await loadData()
  }

  const toggleTokenSlot = async (slot: TokenSlot) => {
    const { error: updateError } = await supabase
      .from('ai_api_token_slots')
      .update({ active: !slot.active })
      .eq('id', slot.id)

    if (updateError) setError(updateError.message)
    await loadData()
  }

  const deleteModel = async (id: string) => {
    const { error: deleteError } = await supabase
      .from('ai_api_models')
      .delete()
      .eq('id', id)

    if (deleteError) setError(deleteError.message)
    await loadData()
  }

  const deleteTokenSlot = async (id: string) => {
    const { error: deleteError } = await supabase
      .from('ai_api_token_slots')
      .delete()
      .eq('id', id)

    if (deleteError) setError(deleteError.message)
    await loadData()
  }

  const copyCurl = async () => {
    await navigator.clipboard.writeText(curlCommand)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  const changeProvider = (provider: ProviderKey) => {
    setSelectedProvider(provider)
    setSelectedModelId(models.find((model) => model.provider === provider)?.id || '')
    setSelectedTokenSlotId(tokenSlots.find((slot) => slot.provider === provider)?.id || '')
    setModelForm((current) => ({
      ...current,
      provider,
      priority: models.filter((model) => model.provider === provider).length + 1,
    }))
    setTokenForm((current) => ({
      ...current,
      provider,
      priority: tokenSlots.filter((slot) => slot.provider === provider).length + 1,
    }))
  }

  const renderFallback = () =>
    result?.fallback ? (
      <div className="fallback-box">
        <strong>
          Attempts {result.fallback.attempted}
          {result.fallback.switchedModel ? ' / model switched' : ''}
          {result.fallback.switchedToken ? ' / token switched' : ''}
          {result.fallback.latencyMs ? ` / ${result.fallback.latencyMs}ms` : ''}
        </strong>
        {result.fallback.attempts.length > 0 ? (
          <ul>
            {result.fallback.attempts.map((attempt, index) => (
              <li key={`${attempt.model}-${attempt.tokenSlot}-${index}`}>
                <span>{attempt.reason}</span>
                {attempt.status}: {attempt.model} via {attempt.tokenSlot}
              </li>
            ))}
          </ul>
        ) : (
          <span className="muted-text">First route worked.</span>
        )}
      </div>
    ) : null

  return (
    <main className="app-frame">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-mark">
            <span>API</span>
          </div>
          <button className="sidebar-toggle" type="button" aria-label="Collapse sidebar">
            <PanelLeft size={18} />
          </button>
        </div>

        <button className="new-chat-button" type="button" onClick={() => setActivePage('chat')}>
          <Plus size={18} />
          New Chat
          <kbd>Ctrl</kbd>
          <kbd>K</kbd>
        </button>

        <nav className="side-nav" aria-label="Primary">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                className={`nav-button ${activePage === item.key ? 'active' : ''}`}
                key={item.key}
                type="button"
                onClick={() => setActivePage(item.key)}
              >
                <Icon size={19} />
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
              </button>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <span>AI API Console</span>
          <strong>{new URL(functionUrl).hostname}</strong>
        </div>
      </aside>

      <section className="app-content">
        {activePage !== 'chat' && (
          <header className="page-header">
            <div>
              <span className="section-label">{currentPage.description}</span>
              <h1>{currentPage.label}</h1>
            </div>
            <div className="header-actions">
              <div className="provider-switch" role="group" aria-label="Provider">
                {providers.map((provider) => (
                  <button
                    className={selectedProvider === provider ? 'active' : ''}
                    key={provider}
                    type="button"
                    onClick={() => changeProvider(provider)}
                  >
                    {provider === 'nvidia' ? 'NVIDIA' : 'OpenRouter'}
                  </button>
                ))}
              </div>
              <div className="status-pill">
                <Database size={17} />
                {activeModels.length}/{providerModels.length} models
              </div>
              <div className="status-pill">
                <KeyRound size={17} />
                {activeTokens.length}/{providerTokenSlots.length} tokens
              </div>
            </div>
          </header>
        )}

        <div className="mobile-tabs" aria-label="Primary mobile">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                className={activePage === item.key ? 'active' : ''}
                key={item.key}
                type="button"
                onClick={() => setActivePage(item.key)}
              >
                <Icon size={17} />
                {item.label}
              </button>
            )
          })}
        </div>

        {error && <div className="alert alert-danger compact-alert">{error}</div>}

        {activePage === 'overview' && (
          <section className="page-stack">
            <div className="metric-grid">
              <div className="metric-panel">
                <span>Provider URL</span>
                <strong>{selectedProviderUrl?.chat_completions_url ?? functionUrl}</strong>
              </div>
              <div className="metric-panel">
                <span>Primary model</span>
                <strong>{activeModels[0]?.name ?? 'No active model'}</strong>
              </div>
              <div className="metric-panel">
                <span>Primary token</span>
                <strong>{activeTokens[0]?.display_name ?? 'No active token'}</strong>
              </div>
              <div className="metric-panel">
                <span>Last model used</span>
                <strong>{result?.model ?? 'Not run yet'}</strong>
              </div>
            </div>

            <div className="panel">
              <div className="panel-heading">
                <div>
                  <span className="section-label">Routing</span>
                  <h2>Failover order</h2>
                </div>
              </div>
              <div className="route-grid">
                <div>
                  <h3>Models</h3>
                  {activeModels.slice(0, 8).map((model) => (
                    <div className="route-item" key={model.id}>
                      <span>{model.priority}</span>
                      <strong>{model.name}</strong>
                    </div>
                  ))}
                </div>
                <div>
                  <h3>Tokens</h3>
                  {activeTokens.map((slot) => (
                    <div className="route-item" key={slot.id}>
                      <span>{slot.priority}</span>
                      <strong>{slot.display_name}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {activePage === 'chat' && (
          <form className="chat-workspace" onSubmit={runChat}>
            <div className="chat-titlebar">
              <button className="chat-title-button" type="button">
                Test API Power Chat
                <ChevronDown size={16} />
              </button>
              <div className="chat-provider-pills">
                <button
                  className={selectedProvider === 'nvidia' ? 'active' : ''}
                  type="button"
                  onClick={() => changeProvider('nvidia')}
                >
                  NVIDIA
                </button>
                <button
                  className={selectedProvider === 'openrouter' ? 'active' : ''}
                  type="button"
                  onClick={() => changeProvider('openrouter')}
                >
                  OpenRouter
                </button>
              </div>
            </div>

            <section className="chat-canvas" aria-live="polite">
              <div className="assistant-row">
                <div className="assistant-avatar">
                  <Bot size={18} />
                </div>
                <div className="assistant-message">Hello! How can I help you today?</div>
              </div>

              {(submittedPrompt || loading || result?.content) && (
                <div className="user-row">
                  <div className="user-message">{submittedPrompt || prompt}</div>
                </div>
              )}

              {loading && (
                <div className="assistant-row">
                  <div className="assistant-avatar">
                    <Loader2 className="spin" size={18} />
                  </div>
                  <div className="assistant-message thinking">Running {selectedProvider}...</div>
                </div>
              )}

              {result?.content && (
                <div className="assistant-card">
                  <div className="assistant-card-meta">
                    <span>{result.provider ?? selectedProvider}</span>
                    <span>{result.model}</span>
                    <span>{result.tokenSlot}</span>
                  </div>
                  <pre>{result.content}</pre>
                  {result.usage && (
                    <div className="usage-row">
                      <span>Prompt {result.usage.prompt_tokens ?? 0}</span>
                      <span>Completion {result.usage.completion_tokens ?? 0}</span>
                      <span>Total {result.usage.total_tokens ?? 0}</span>
                    </div>
                  )}
                  {renderFallback()}
                </div>
              )}
            </section>

            <section className="chat-composer">
              <textarea
                aria-label="Prompt"
                placeholder="Ask away. API models work too."
                value={prompt}
                onKeyDown={handlePromptKeyDown}
                onChange={(event) => setPrompt(event.target.value)}
              />
              <div className="composer-controls">
                <button className="round-tool" type="button" aria-label="New prompt">
                  <Plus size={22} />
                </button>
                <div className="composer-selects">
                  <select
                    aria-label="Model"
                    value={selectedModelId}
                    onChange={(event) => setSelectedModelId(event.target.value)}
                  >
                    {providerModels.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.priority}. {model.name}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label="Token slot"
                    value={selectedTokenSlotId}
                    onChange={(event) => setSelectedTokenSlotId(event.target.value)}
                  >
                    {providerTokenSlots.map((slot) => (
                      <option key={slot.id} value={slot.id}>
                        {slot.display_name}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label="Max tokens"
                    min="1"
                    type="number"
                    value={maxTokens}
                    onChange={(event) => setMaxTokens(Number(event.target.value))}
                  />
                  <input
                    aria-label="Temperature"
                    max="2"
                    min="0"
                    step="0.1"
                    type="number"
                    value={temperature}
                    onChange={(event) => setTemperature(Number(event.target.value))}
                  />
                  <input
                    aria-label="Top P"
                    max="1"
                    min="0"
                    step="0.1"
                    type="number"
                    value={topP}
                    onChange={(event) => setTopP(Number(event.target.value))}
                  />
                </div>
                <button className="send-fab" disabled={loading} type="submit" aria-label="Run">
                  {loading ? <Loader2 className="spin" size={22} /> : <ArrowUp size={22} />}
                </button>
              </div>
            </section>
          </form>
        )}

        {activePage === 'models' && (
          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="section-label">Database table</span>
                <h2>Models</h2>
              </div>
            </div>

            <form className="inline-form" onSubmit={saveModel}>
              <input
                className="form-control small-input"
                min="1"
                type="number"
                value={modelForm.priority}
                onChange={(event) =>
                  setModelForm({ ...modelForm, priority: Number(event.target.value) })
                }
              />
              <input
                className="form-control"
                placeholder="provider/model-name"
                value={modelForm.name}
                onChange={(event) =>
                  setModelForm({ ...modelForm, name: event.target.value })
                }
              />
              <button className="btn btn-outline-dark icon-btn" disabled={saving} type="submit">
                <Plus size={17} />
                Add
              </button>
            </form>

            <div className="table-wrap large-table">
              <table className="table table-sm align-middle">
                <thead>
                  <tr>
                    <th>Priority</th>
                    <th>Model</th>
                    <th>Provider</th>
                    <th>Status</th>
                    <th aria-label="Actions"></th>
                  </tr>
                </thead>
                <tbody>
                  {providerModels.map((model) => (
                    <tr key={model.id}>
                      <td>{model.priority}</td>
                      <td className="model-name">{model.name}</td>
                      <td>{model.provider}</td>
                      <td>
                        <button
                          className={`btn btn-sm ${
                            model.active ? 'btn-success' : 'btn-secondary'
                          }`}
                          type="button"
                          onClick={() => void toggleModel(model)}
                        >
                          {model.active ? 'Active' : 'Off'}
                        </button>
                      </td>
                      <td className="actions-cell">
                        <button
                          className="btn btn-sm btn-outline-danger icon-only"
                          type="button"
                          onClick={() => void deleteModel(model.id)}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activePage === 'tokens' && (
          <section className="panel">
            <div className="panel-heading">
              <div>
                <span className="section-label">Edge secret slots</span>
                <h2>Tokens</h2>
              </div>
              <KeyRound size={20} />
            </div>

            <form className="inline-form token-form" onSubmit={saveTokenSlot}>
              <input
                className="form-control small-input"
                min="1"
                type="number"
                value={tokenForm.priority}
                onChange={(event) =>
                  setTokenForm({ ...tokenForm, priority: Number(event.target.value) })
                }
              />
              <input
                className="form-control"
                placeholder="Display name"
                value={tokenForm.display_name}
                onChange={(event) =>
                  setTokenForm({ ...tokenForm, display_name: event.target.value })
                }
              />
              <input
                className="form-control"
                placeholder="secret-name"
                value={tokenForm.secret_name}
                onChange={(event) =>
                  setTokenForm({ ...tokenForm, secret_name: event.target.value })
                }
              />
              <button className="btn btn-outline-dark icon-only" disabled={saving} type="submit">
                <Save size={17} />
              </button>
            </form>

            <div className="token-list token-grid">
              {providerTokenSlots.map((slot) => (
                <div className="token-item" key={slot.id}>
                  <div>
                    <strong>{slot.display_name}</strong>
                    <span>{slot.secret_name}</span>
                  </div>
                  <div className="token-actions">
                    <button
                      className={`btn btn-sm ${slot.active ? 'btn-success' : 'btn-secondary'}`}
                      type="button"
                      onClick={() => void toggleTokenSlot(slot)}
                    >
                      {slot.active ? 'Active' : 'Off'}
                    </button>
                    <button
                      className="btn btn-sm btn-outline-danger icon-only"
                      type="button"
                      onClick={() => void deleteTokenSlot(slot.id)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {activePage === 'curl' && (
          <section className="page-stack curl-page">
            <div className="panel">
              <div className="panel-heading">
                <div>
                  <span className="section-label">Selected provider</span>
                  <h2>{selectedProvider === 'nvidia' ? 'NVIDIA curl' : 'OpenRouter curl'}</h2>
                </div>
                <button className="btn btn-outline-dark icon-btn" type="button" onClick={copyCurl}>
                  {copied ? <CheckCircle2 size={18} /> : <Copy size={18} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre className="curl-block">{curlCommand}</pre>
            </div>
            <div className="curl-grid">
              <div className="panel">
                <div className="panel-heading">
                  <div>
                    <span className="section-label">Separate curl</span>
                    <h2>NVIDIA</h2>
                  </div>
                </div>
                <pre className="curl-block small-curl">{nvidiaCurlCommand}</pre>
              </div>
              <div className="panel">
                <div className="panel-heading">
                  <div>
                    <span className="section-label">Separate curl</span>
                    <h2>OpenRouter</h2>
                  </div>
                </div>
                <pre className="curl-block small-curl">{openRouterCurlCommand}</pre>
              </div>
            </div>
          </section>
        )}
      </section>
    </main>
  )
}

export default App
