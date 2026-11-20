<script lang="ts">
  import { onMount } from 'svelte'
  import { api } from '../lib/api'
  import type { PracticeProblem } from '../../shared/types'

  let timerRunning  = false
  let timerSeconds  = 0
  let intervalId: ReturnType<typeof setInterval> | null = null
  let selectedDuration = 120  // minutes

  const PRESET_DURATIONS = [60, 90, 120, 180, 300]

  function startTimer() {
    timerSeconds = selectedDuration * 60
    timerRunning = true
    intervalId = setInterval(() => {
      if (timerSeconds > 0) {
        timerSeconds--
      } else {
        stopTimer()
      }
    }, 1000)
  }

  function stopTimer() {
    timerRunning = false
    if (intervalId) { clearInterval(intervalId); intervalId = null }
  }

  function resetTimer() {
    stopTimer()
    timerSeconds = 0
  }

  function formatTimer(secs: number): string {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    const s = secs % 60
    if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  }

  const DEFAULT_PROBLEMS: PracticeProblem[] = [
    { id: '1900A', contestId: 1900, index: 'A', name: 'Cover in Water', url: 'https://codeforces.com/problemset/problem/1900/A', tags: ['greedy', 'constructive algorithms', 'implementation'], rating: 800, solved: false },
    { id: '1850C', contestId: 1850, index: 'C', name: 'Word on the Paper', url: 'https://codeforces.com/problemset/problem/1850/C', tags: ['greedy', 'strings'], rating: 800, solved: false },
    { id: '1878D', contestId: 1878, index: 'D', name: 'Reverse Sort Sum', url: 'https://codeforces.com/problemset/problem/1878/D', tags: ['data structures', 'math'], rating: 1700, solved: false },
  ]

  const STORAGE_KEY = 'codersnote_practice_problems'

  let problems: PracticeProblem[] = []
  let problemInput = ''
  let adding = false
  let errorMessage = ''
  let successMessage = ''
  let flashTimeout: ReturnType<typeof setTimeout> | null = null

  onMount(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          problems = parsed
        } else {
          problems = [...DEFAULT_PROBLEMS]
          saveToStorage()
        }
      } else {
        problems = [...DEFAULT_PROBLEMS]
        saveToStorage()
      }
    } catch {
      problems = [...DEFAULT_PROBLEMS]
    }
  })

  function saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(problems))
    } catch (e) {
      console.error('Failed to save practice problems to localStorage:', e)
    }
  }

  function showFlash(success = '', error = '') {
    successMessage = success
    errorMessage = error
    if (flashTimeout) clearTimeout(flashTimeout)
    if (success) {
      flashTimeout = setTimeout(() => {
        successMessage = ''
      }, 4500)
    }
  }

  async function addProblem() {
    const raw = problemInput.trim()
    if (!raw) return

    errorMessage = ''
    successMessage = ''
    adding = true

    try {
      const res = await api.getCFProblem(raw)
      if (!res.ok) {
        showFlash('', res.error || 'Failed to fetch problem from Codeforces')
        return
      }

      const p = res.data
      if (problems.some(existing => existing.id.toUpperCase() === p.id.toUpperCase())) {
        showFlash('', `Problem ${p.id} is already in your practice set.`)
        return
      }

      problems = [{ ...p, solved: false, addedAt: Date.now() }, ...problems]
      saveToStorage()
      problemInput = ''
      showFlash(`Problem ${p.id} — "${p.name}" added successfully!`)
    } catch (e: unknown) {
      showFlash('', e instanceof Error ? e.message : String(e))
    } finally {
      adding = false
    }
  }

  function quickAdd(code: string) {
    problemInput = code
    addProblem()
  }

  function removeProblem(id: string) {
    problems = problems.filter(p => p.id !== id)
    saveToStorage()
  }

  function toggleSolved(id: string) {
    problems = problems.map(p => {
      if (p.id === id) {
        return { ...p, solved: !p.solved }
      }
      return p
    })
    saveToStorage()
  }

  function resetToDefaults() {
    problems = [...DEFAULT_PROBLEMS]
    saveToStorage()
    showFlash('Restored default practice set.')
  }

  function clearAllProblems() {
    problems = []
    saveToStorage()
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !adding && problemInput.trim()) {
      addProblem()
    }
  }

  $: solvedCount = problems.filter(p => p.solved).length
  $: progressPercent = problems.length ? Math.round((solvedCount / problems.length) * 100) : 0
</script>

<div class="practice-page anim-fade-in">
  <header class="page-header">
    <h1 class="page-title">Virtual Contest Session</h1>
    <p class="subtitle">Timed focus mode — simulate contest conditions with countdown reminders</p>
  </header>

  <!-- Timer Card -->
  <div class="timer-card">
    <div
      class="timer-box"
      class:timer-box--running={timerRunning}
      class:timer-box--urgent={timerSeconds > 0 && timerSeconds < 300}
    >
      <span class="timer-digits">
        {#if timerSeconds > 0 || timerRunning}
          {formatTimer(timerSeconds)}
        {:else}
          {formatTimer(selectedDuration * 60)}
        {/if}
      </span>
      <span class="timer-status">
        {#if timerRunning}
          ROUND ACTIVE
        {:else if timerSeconds > 0}
          PAUSED
        {:else}
          READY
        {/if}
      </span>
    </div>

    <!-- Duration Selection -->
    {#if !timerRunning && timerSeconds === 0}
      <div class="duration-section">
        <span class="duration-label">Set Session Duration:</span>
        <div class="duration-chips">
          {#each PRESET_DURATIONS as d}
            <button
              class="duration-chip"
              class:duration-chip--active={selectedDuration === d}
              on:click={() => selectedDuration = d}
            >
              {d < 60 ? d + ' min' : (d/60) + ' hrs'}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Timer Controls -->
    <div class="timer-controls">
      {#if !timerRunning}
        <button class="btn btn--green" on:click={startTimer} id="btn-start-timer">
          <span>▶</span> Start Session
        </button>
      {:else}
        <button class="btn btn--red" on:click={stopTimer} id="btn-stop-timer">
          <span>⏸</span> Pause
        </button>
      {/if}
      <button class="btn btn--outline" on:click={resetTimer} id="btn-reset-timer">
        <span>↺</span> Reset
      </button>
    </div>
  </div>

  <!-- Add Problem Card -->
  <div class="add-problem-card">
    <div class="add-header">
      <div class="add-header-title">
        <span class="cf-badge">CF</span>
        <span class="add-title-text">Add Problem from Codeforces</span>
      </div>
      <span class="add-header-hint">Enter problem number or link</span>
    </div>

    <div class="add-form">
      <div class="input-wrapper">
        <input
          type="text"
          class="input-field mono"
          placeholder="e.g. 1900A, 4A, 1850C, 1234D1, or codeforces.com/... link"
          bind:value={problemInput}
          on:keydown={handleKeydown}
          disabled={adding}
          id="input-cf-problem"
        />
        {#if problemInput}
          <button
            class="clear-input-btn"
            on:click={() => { problemInput = ''; errorMessage = '' }}
            title="Clear input"
          >
            ✕
          </button>
        {/if}
      </div>

      <button
        class="btn btn--primary add-btn"
        on:click={addProblem}
        disabled={adding || !problemInput.trim()}
        id="btn-add-problem"
      >
        {#if adding}
          <span class="spinner-sm anim-spin"></span>
          <span>Adding...</span>
        {:else}
          <span class="plus-icon">+</span>
          <span>Add Problem</span>
        {/if}
      </button>
    </div>

    <!-- Quick suggestions -->
    <div class="quick-examples">
      <span class="quick-label">Try quick:</span>
      {#each ['1900A', '4A', '71A', '1850C', '1878D'] as ex}
        <button
          class="quick-chip mono"
          disabled={adding}
          on:click={() => quickAdd(ex)}
          title="Add {ex}"
        >
          +{ex}
        </button>
      {/each}
    </div>

    {#if errorMessage}
      <div class="msg-banner msg-banner--error anim-fade-in">
        <span class="msg-icon">⚠</span>
        <span class="msg-text">{errorMessage}</span>
        <button class="msg-close" on:click={() => errorMessage = ''} aria-label="Dismiss error">✕</button>
      </div>
    {/if}

    {#if successMessage}
      <div class="msg-banner msg-banner--success anim-fade-in">
        <span class="msg-icon">✓</span>
        <span class="msg-text">{successMessage}</span>
        <button class="msg-close" on:click={() => successMessage = ''} aria-label="Dismiss message">✕</button>
      </div>
    {/if}
  </div>

  <!-- Problems Card -->
  <div class="problems-card">
    <div class="problems-header">
      <div class="problems-header-main">
        <div class="problems-title-row">
          <h2 class="section-title">Practice Set</h2>
          <span class="problem-count-badge">
            {problems.length} {problems.length === 1 ? 'problem' : 'problems'}
          </span>
          {#if problems.length > 0}
            <span
              class="solved-pill"
              class:solved-pill--complete={solvedCount === problems.length && problems.length > 0}
            >
              {solvedCount} / {problems.length} solved
            </span>
          {/if}
        </div>
        <p class="section-subtitle">Open each problem in browser, solve against the clock, and review solutions</p>
      </div>

      <div class="problems-actions">
        {#if problems.length > 0}
          <button class="btn-text-action btn-text-action--danger" on:click={clearAllProblems}>
            Clear All
          </button>
        {/if}
        <button class="btn-text-action" on:click={resetToDefaults}>
          Reset Defaults
        </button>
      </div>
    </div>

    <!-- Progress bar -->
    {#if problems.length > 0}
      <div class="progress-container">
        <div class="progress-track">
          <div
            class="progress-fill"
            class:progress-fill--complete={progressPercent === 100}
            style="width: {progressPercent}%"
          ></div>
        </div>
        <span class="progress-label mono">{progressPercent}%</span>
      </div>
    {/if}

    <div class="problem-list">
      {#if problems.length === 0}
        <div class="empty-state anim-fade-in">
          <div class="empty-icon">📝</div>
          <p class="empty-title">No problems in your practice set</p>
          <p class="empty-desc">
            Enter a Codeforces problem number above (e.g. <code>1900A</code> or <code>4A</code>) to start your customized training session.
          </p>
          <button class="btn btn--outline btn--sm mt-3" on:click={resetToDefaults}>
            Load Default Practice Problems
          </button>
        </div>
      {:else}
        {#each problems as p (p.id)}
          <div class="problem-row" class:problem-row--solved={p.solved}>
            <!-- Solved Toggle Checkbox -->
            <button
              class="solved-checkbox"
              class:solved-checkbox--checked={p.solved}
              on:click={() => toggleSolved(p.id)}
              title={p.solved ? 'Mark problem as unsolved' : 'Mark problem as solved'}
              aria-label={p.solved ? 'Mark problem as unsolved' : 'Mark problem as solved'}
            >
              {#if p.solved}✓{/if}
            </button>

            <!-- Problem ID badge -->
            <span class="problem-code mono">{p.id}</span>

            <!-- Problem Name & Tags -->
            <div class="problem-meta">
              <div class="problem-name-row">
                <span class="problem-name" class:problem-name--solved={p.solved}>
                  {p.name}
                </span>
                {#if p.solved}
                  <span class="solved-tag">SOLVED</span>
                {/if}
              </div>
              <div class="problem-tags">
                {#if p.tags && p.tags.length > 0}
                  {#each p.tags.slice(0, 4) as tag}
                    <span class="problem-tag">#{tag}</span>
                  {/each}
                  {#if p.tags.length > 4}
                    <span class="problem-tag problem-tag--more">+{p.tags.length - 4}</span>
                  {/if}
                {:else}
                  <span class="problem-tag text-muted">#codeforces</span>
                {/if}
              </div>
            </div>

            <!-- Rating badge -->
            {#if p.rating}
              <span
                class="problem-rating-pill"
                class:problem-rating-pill--easy={p.rating < 1400}
                class:problem-rating-pill--med={p.rating >= 1400 && p.rating < 1800}
                class:problem-rating-pill--hard={p.rating >= 1800}
              >
                ★ {p.rating}
              </span>
            {:else}
              <span class="problem-rating-pill problem-rating-pill--unrated">
                Unrated
              </span>
            {/if}

            <!-- Solve external button -->
            <button
              class="btn btn--outline btn--sm solve-btn"
              on:click={() => window.open(p.url, '_blank')}
              title="Open problem {p.id} on Codeforces in browser"
            >
              Solve ↗
            </button>

            <!-- Remove button -->
            <button
              class="btn-remove-row"
              on:click={() => removeProblem(p.id)}
              title="Remove problem from practice set"
              aria-label="Remove problem"
            >
              ✕
            </button>
          </div>
        {/each}
      {/if}
    </div>
  </div>
</div>

<style>
  .practice-page {
    max-width: 960px;
    margin: 0 auto;
  }

  .page-header {
    margin-bottom: var(--space-5);
  }

  .page-title {
    font-size: var(--text-2xl);
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.02em;
  }

  .subtitle {
    color: var(--text-secondary);
    font-size: var(--text-sm);
    font-weight: 500;
    margin-top: 2px;
  }

  /* ── Timer Card ────────────────────────────────────────────────────────── */
  .timer-card {
    background: #FFFFFF;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-clay-card);
    padding: var(--space-6);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-5);
    margin-bottom: var(--space-5);
    border: 1px solid var(--border-subtle);
  }

  .timer-box {
    background: #FAF9F6;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-lg);
    padding: var(--space-5) var(--space-10);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    max-width: 420px;
  }

  .timer-digits {
    font-size: 64px;
    font-family: var(--font-mono);
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -1px;
    line-height: 1;
  }

  .timer-status {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-muted);
    letter-spacing: 0.08em;
    margin-top: var(--space-2);
  }

  .timer-box--running .timer-digits {
    color: var(--clay-green);
  }

  .timer-box--running .timer-status {
    color: var(--clay-green);
  }

  .timer-box--urgent .timer-digits {
    color: var(--clay-red);
  }

  .timer-box--urgent .timer-status {
    color: var(--clay-red);
  }

  .duration-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
  }

  .duration-label {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .duration-chips {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
    justify-content: center;
  }

  .duration-chip {
    padding: 6px var(--space-3);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-full);
    background: #FFFFFF;
    color: var(--text-secondary);
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .duration-chip:hover {
    border-color: var(--border-strong);
    color: var(--text-primary);
  }

  .duration-chip--active {
    background: var(--clay-yellow-bg);
    border-color: var(--clay-yellow-border);
    color: var(--clay-yellow-text);
  }

  .timer-controls {
    display: flex;
    gap: var(--space-3);
    justify-content: center;
  }

  /* ── Add Problem Card ──────────────────────────────────────────────────── */
  .add-problem-card {
    background: #FFFFFF;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-clay-card);
    padding: var(--space-4) var(--space-5);
    margin-bottom: var(--space-5);
    border: 1px solid var(--border-subtle);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .add-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .add-header-title {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .cf-badge {
    font-size: 10px;
    font-weight: 800;
    font-family: var(--font-mono);
    background: #1877F2;
    color: #FFFFFF;
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    letter-spacing: 0.05em;
  }

  .add-title-text {
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--text-primary);
  }

  .add-header-hint {
    font-size: var(--text-xs);
    color: var(--text-muted);
  }

  .add-form {
    display: flex;
    gap: var(--space-3);
    align-items: center;
  }

  .input-wrapper {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
  }

  .input-field {
    width: 100%;
    padding: 9px var(--space-4);
    padding-right: 32px;
    background: #FAF9F6;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-md);
    font-size: var(--text-sm);
    color: var(--text-primary);
    transition: all var(--transition-fast);
  }

  .input-field:focus {
    outline: none;
    background: #FFFFFF;
    border-color: var(--clay-orange);
    box-shadow: 0 0 0 3px rgba(224, 90, 43, 0.12);
  }

  .input-field::placeholder {
    color: var(--text-muted);
    font-family: var(--font-sans);
    font-size: var(--text-xs);
  }

  .clear-input-btn {
    position: absolute;
    right: 10px;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 12px;
    padding: 4px;
    border-radius: var(--radius-full);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .clear-input-btn:hover {
    color: var(--text-primary);
  }

  .add-btn {
    white-space: nowrap;
    padding: 9px var(--space-5);
  }

  .plus-icon {
    font-size: 16px;
    line-height: 1;
  }

  .spinner-sm {
    width: 13px;
    height: 13px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #FFFFFF;
    border-radius: 50%;
    display: inline-block;
  }

  .quick-examples {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .quick-label {
    font-size: 11px;
    color: var(--text-muted);
    font-weight: 500;
  }

  .quick-chip {
    background: #F4F2EC;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-full);
    padding: 2px var(--space-2);
    font-size: 11px;
    font-weight: 600;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .quick-chip:hover:not(:disabled) {
    background: var(--clay-orange-bg);
    border-color: var(--clay-orange-border);
    color: var(--clay-orange-text);
  }

  .quick-chip:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ── Message Banners ───────────────────────────────────────────────────── */
  .msg-banner {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    font-size: var(--text-xs);
    font-weight: 500;
  }

  .msg-banner--error {
    background: #FEF2F2;
    border: 1px solid #FECACA;
    color: #991B1B;
  }

  .msg-banner--success {
    background: #F0FDF4;
    border: 1px solid #BBF7D0;
    color: #166534;
  }

  .msg-icon {
    font-weight: 700;
    font-size: 13px;
  }

  .msg-text {
    flex: 1;
  }

  .msg-close {
    background: none;
    border: none;
    font-size: 12px;
    cursor: pointer;
    color: inherit;
    opacity: 0.7;
    padding: 2px 6px;
    border-radius: var(--radius-sm);
  }

  .msg-close:hover {
    opacity: 1;
  }

  /* ── Buttons ───────────────────────────────────────────────────────────── */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px var(--space-5);
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .btn--primary {
    background: var(--clay-orange);
    color: #FFFFFF;
    box-shadow: var(--shadow-clay-btn-orange);
  }

  .btn--primary:hover:not(:disabled) {
    filter: brightness(1.06);
  }

  .btn--green {
    background: var(--clay-green);
    color: #FFFFFF;
    box-shadow: var(--shadow-clay-btn-green);
  }

  .btn--green:hover { filter: brightness(1.06); }

  .btn--red {
    background: var(--clay-red);
    color: #FFFFFF;
  }

  .btn--red:hover { filter: brightness(1.06); }

  .btn--outline {
    background: #FFFFFF;
    color: var(--text-primary);
    border-color: var(--border-default);
  }

  .btn--outline:hover {
    background: #F7F6F2;
    border-color: var(--border-strong);
  }

  .btn--sm {
    padding: 5px var(--space-3);
    font-size: var(--text-xs);
  }

  /* ── Problems Card ─────────────────────────────────────────────────────── */
  .problems-card {
    background: #FFFFFF;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-clay-card);
    padding: var(--space-5);
    border: 1px solid var(--border-subtle);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .problems-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding-bottom: var(--space-2);
    border-bottom: 1px solid var(--border-subtle);
    gap: var(--space-3);
    flex-wrap: wrap;
  }

  .problems-title-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .section-title {
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--text-primary);
  }

  .problem-count-badge {
    background: #F4F2EC;
    color: var(--text-secondary);
    font-size: 11px;
    font-weight: 600;
    padding: 1px var(--space-2);
    border-radius: var(--radius-full);
    border: 1px solid var(--border-subtle);
  }

  .solved-pill {
    background: var(--clay-yellow-bg);
    color: var(--clay-yellow-text);
    font-size: 11px;
    font-weight: 700;
    padding: 1px var(--space-2);
    border-radius: var(--radius-full);
    border: 1px solid var(--clay-yellow-border);
  }

  .solved-pill--complete {
    background: var(--clay-green-bg);
    color: var(--clay-green-text);
    border-color: var(--clay-green-border);
  }

  .section-subtitle {
    color: var(--text-secondary);
    font-size: var(--text-xs);
    font-weight: 500;
    margin-top: 2px;
  }

  .problems-actions {
    display: flex;
    gap: var(--space-3);
    align-items: center;
  }

  .btn-text-action {
    background: none;
    border: none;
    color: var(--text-secondary);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    padding: 4px 6px;
    border-radius: var(--radius-sm);
    transition: all var(--transition-fast);
  }

  .btn-text-action:hover {
    color: var(--text-primary);
    background: #F4F2EC;
  }

  .btn-text-action--danger:hover {
    color: var(--clay-red);
    background: #FEE2E2;
  }

  /* ── Progress Bar ──────────────────────────────────────────────────────── */
  .progress-container {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: 2px 0 var(--space-1) 0;
  }

  .progress-track {
    flex: 1;
    height: 6px;
    background: #EDEAE1;
    border-radius: var(--radius-full);
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--clay-orange);
    border-radius: var(--radius-full);
    transition: width 0.3s ease;
  }

  .progress-fill--complete {
    background: var(--clay-green);
  }

  .progress-label {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-secondary);
    min-width: 32px;
    text-align: right;
  }

  /* ── Problem List & Rows ────────────────────────────────────────────────── */
  .problem-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .problem-row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    background: #FAF9F6;
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-subtle);
    transition: all var(--transition-fast);
  }

  .problem-row:hover {
    border-color: var(--border-default);
    background: #F7F6F2;
  }

  .problem-row--solved {
    background: #F4F9F4;
    border-color: #D1E7DD;
    opacity: 0.88;
  }

  /* Solved Checkbox */
  .solved-checkbox {
    width: 22px;
    height: 22px;
    border-radius: 6px;
    border: 1.5px solid var(--border-strong);
    background: #FFFFFF;
    color: #FFFFFF;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
    transition: all var(--transition-fast);
    flex-shrink: 0;
  }

  .solved-checkbox:hover {
    border-color: var(--clay-green);
    transform: scale(1.05);
  }

  .solved-checkbox--checked {
    background: var(--clay-green);
    border-color: var(--clay-green);
  }

  .problem-code {
    font-size: var(--text-xs);
    font-weight: 700;
    color: var(--clay-orange);
    background: var(--clay-orange-bg);
    padding: 2px var(--space-2);
    border-radius: var(--radius-sm);
    min-width: 58px;
    text-align: center;
    flex-shrink: 0;
  }

  .problem-meta {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .problem-name-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .problem-name {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .problem-name--solved {
    text-decoration: line-through;
    color: var(--text-secondary);
  }

  .solved-tag {
    font-size: 9px;
    font-weight: 800;
    color: var(--clay-green-text);
    background: var(--clay-green-bg);
    padding: 1px 5px;
    border-radius: var(--radius-sm);
    letter-spacing: 0.04em;
    flex-shrink: 0;
  }

  .problem-tags {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .problem-tag {
    font-size: 10px;
    color: var(--text-muted);
  }

  .problem-tag--more {
    font-weight: 600;
    color: var(--text-secondary);
  }

  .problem-rating-pill {
    font-size: 11px;
    font-weight: 700;
    font-family: var(--font-mono);
    padding: 2px var(--space-2);
    border-radius: var(--radius-full);
    white-space: nowrap;
    flex-shrink: 0;
  }

  .problem-rating-pill--easy {
    background: var(--clay-green-bg);
    color: var(--clay-green-text);
  }

  .problem-rating-pill--med {
    background: var(--clay-yellow-bg);
    color: var(--clay-yellow-text);
  }

  .problem-rating-pill--hard {
    background: var(--clay-orange-bg);
    color: var(--clay-orange-text);
  }

  .problem-rating-pill--unrated {
    background: #F4F2EC;
    color: var(--text-muted);
  }

  .solve-btn {
    flex-shrink: 0;
  }

  .btn-remove-row {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 12px;
    padding: 4px 6px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all var(--transition-fast);
    flex-shrink: 0;
  }

  .btn-remove-row:hover {
    color: var(--clay-red);
    background: #FEE2E2;
  }

  /* ── Empty State ───────────────────────────────────────────────────────── */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-8) var(--space-4);
    text-align: center;
  }

  .empty-icon {
    font-size: 32px;
    margin-bottom: var(--space-2);
  }

  .empty-title {
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--text-primary);
  }

  .empty-desc {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    max-width: 400px;
    margin-top: 4px;
    line-height: 1.5;
  }

  .empty-desc code {
    background: #EDEAE1;
    padding: 1px 4px;
    border-radius: 4px;
    font-family: var(--font-mono);
    color: var(--clay-orange);
  }

  .mt-3 {
    margin-top: var(--space-3);
  }
</style>
