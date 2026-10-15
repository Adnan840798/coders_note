<script lang="ts">
  import { api } from '../lib/api'
  import type { AnalysisResult, Platform } from '../../shared/types'

  let handleA = '', platformA: Platform = 'codeforces'
  let handleB = '', platformB: Platform = 'codeforces'
  let resultA: AnalysisResult | null = null
  let resultB: AnalysisResult | null = null
  let loading = false
  let error: string | null = null
  let errorField: 'a' | 'b' | 'both' | null = null
  let sortMode: 'gap' | 'a-leads' | 'b-leads' | 'alpha' = 'gap'

  async function compare() {
    if (!handleA.trim() || !handleB.trim()) return
    loading = true; error = null; errorField = null; resultA = null; resultB = null

    const res = await api.compareProfiles(
      { platform: platformA, username: handleA.trim() },
      { platform: platformB, username: handleB.trim() }
    )

    if (res.ok) {
      resultA = res.data.a
      resultB = res.data.b
    } else {
      const raw = res.error ?? ''
      if (raw.startsWith('HANDLE_A:')) {
        error = raw.slice('HANDLE_A:'.length)
        errorField = 'a'
      } else if (raw.startsWith('HANDLE_B:')) {
        error = raw.slice('HANDLE_B:'.length)
        errorField = 'b'
      } else {
        error = raw
        errorField = null
      }
    }
    loading = false
  }

  function getSharedTags(a: AnalysisResult, b: AnalysisResult): string[] {
    const tagsA = new Set(a.allTopics.map(t => t.tag))
    return b.allTopics.filter(t => tagsA.has(t.tag)).map(t => t.tag)
  }

  function sortedTopics(
    shared: string[],
    a: AnalysisResult,
    b: AnalysisResult,
    mode: typeof sortMode
  ) {
    return [...shared]
      .map(tag => ({
        tag,
        tA: a.allTopics.find(t => t.tag === tag)!,
        tB: b.allTopics.find(t => t.tag === tag)!,
      }))
      .filter(r => r.tA && r.tB)
      .sort((x, y) => {
        const gapX = x.tA.accuracy - x.tB.accuracy
        const gapY = y.tA.accuracy - y.tB.accuracy
        if (mode === 'gap')     return Math.abs(gapY) - Math.abs(gapX)
        if (mode === 'a-leads') return gapY - gapX
        if (mode === 'b-leads') return gapX - gapY
        return x.tag.localeCompare(y.tag)
      })
  }

  function getScoreboard(shared: string[], a: AnalysisResult, b: AnalysisResult) {
    let aWins = 0, bWins = 0, ties = 0
    let aAccSum = 0, bAccSum = 0
    for (const tag of shared) {
      const tA = a.allTopics.find(t => t.tag === tag)
      const tB = b.allTopics.find(t => t.tag === tag)
      if (!tA || !tB) continue
      aAccSum += tA.accuracy
      bAccSum += tB.accuracy
      if (tA.accuracy > tB.accuracy)      aWins++
      else if (tB.accuracy > tA.accuracy) bWins++
      else                                 ties++
    }
    const n = aWins + bWins + ties
    return {
      aWins, bWins, ties,
      aAvg: n > 0 ? Math.round((aAccSum / n) * 100) : 0,
      bAvg: n > 0 ? Math.round((bAccSum / n) * 100) : 0,
      leader: aWins > bWins ? 'a' : bWins > aWins ? 'b' : 'tie',
    }
  }
  function setSortMode(m: 'gap' | 'a-leads' | 'b-leads' | 'alpha') {
    sortMode = m
  }

  function getErrorRates(a: AnalysisResult) {
    const t = a.totalSubmissions || 1
    return [
      { label: 'Wrong Answer',        key: 'WRONG_ANSWER',        pct: Math.round(((a.verdictBreakdown['WRONG_ANSWER'] ?? 0) / t) * 100) },
      { label: 'Time Limit',          key: 'TIME_LIMIT_EXCEEDED', pct: Math.round(((a.verdictBreakdown['TIME_LIMIT_EXCEEDED'] ?? 0) / t) * 100) },
      { label: 'Runtime Error',       key: 'RUNTIME_ERROR',       pct: Math.round(((a.verdictBreakdown['RUNTIME_ERROR'] ?? 0) / t) * 100) },
      { label: 'Memory Limit',        key: 'MEMORY_LIMIT_EXCEEDED', pct: Math.round(((a.verdictBreakdown['MEMORY_LIMIT_EXCEEDED'] ?? 0) / t) * 100) },
    ]
  }

  function getRatingBuckets(a: AnalysisResult): { rating: number; count: number }[] {
    return Object.entries(a.solvesByRating ?? {})
      .map(([r, c]) => ({ rating: Number(r), count: c as number }))
      .filter(b => !isNaN(b.rating) && b.rating > 0)
      .sort((x, y) => x.rating - y.rating)
  }
</script>

<div class="compare-page anim-fade-in">
  <header class="page-header">
    <h1 class="page-title">Profile Comparison</h1>
    <p class="subtitle">Side-by-side topic accuracy benchmark between two competitive programmers</p>
  </header>

  <!-- Input Card -->
  <div class="compare-card">
    <div class="handle-field">
      <label class="field-label" for="input-handle-a">Handle A (Terracotta)</label>
      <input
        id="input-handle-a"
        class="input-clean"
        class:input-error={errorField === 'a'}
        placeholder="e.g. tourist"
        bind:value={handleA}
        on:keydown={(e) => e.key === 'Enter' && compare()}
        on:input={() => { error = null; errorField = null }}
      />
      <span class="field-error-hint" class:visible={errorField === 'a'}>Handle not found on Codeforces</span>
    </div>

    <div class="vs-badge">VS</div>

    <div class="handle-field">
      <label class="field-label" for="input-handle-b">Handle B (Forest Green)</label>
      <input
        id="input-handle-b"
        class="input-clean"
        class:input-error={errorField === 'b'}
        placeholder="e.g. Petr"
        bind:value={handleB}
        on:keydown={(e) => e.key === 'Enter' && compare()}
        on:input={() => { error = null; errorField = null }}
      />
      <span class="field-error-hint" class:visible={errorField === 'b'}>Handle not found on Codeforces</span>
    </div>

    <div class="btn-field">
      <button
        class="btn btn--primary"
        on:click={compare}
        disabled={loading || !handleA.trim() || !handleB.trim()}
        id="btn-compare"
      >
        {#if loading}
          <span class="spinner-mini anim-spin" />
          Comparing…
        {:else}
          Compare
        {/if}
      </button>
    </div>
  </div>

  {#if error && errorField === null}
    <div class="banner banner--error">
      <span>⚠️</span>
      <span>{error}</span>
    </div>
  {/if}

  {#if loading}
    <div class="state-card">
      <div class="spinner-brand anim-spin" />
      <p class="state-text">Benchmarking topic accuracy and win rates…</p>
    </div>
  {:else if resultA && resultB}
    {@const shared = getSharedTags(resultA, resultB)}
    {@const score = getScoreboard(shared, resultA, resultB)}
    {@const topics = sortedTopics(shared, resultA, resultB, sortMode)}

    <!-- Scoreboard Summary -->
    <div class="scoreboard-card">
      <div class="scoreboard-side scoreboard-side--a" class:scoreboard-leader={score.leader === 'a'}>
        <span class="sb-handle">{resultA.handle}</span>
        <span class="sb-score">{score.aWins}</span>
        <span class="sb-label">topics won</span>
        <span class="sb-avg">{score.aAvg}% avg accuracy</span>
      </div>

      <div class="scoreboard-center">
        <div class="sb-ratio-bar">
          {#if shared.length > 0}
            <div class="sb-ratio-fill sb-ratio-fill--a" style="width: {Math.round((score.aWins / shared.length) * 100)}%" />
            <div class="sb-ratio-fill sb-ratio-fill--tie" style="width: {Math.round((score.ties / shared.length) * 100)}%" />
            <div class="sb-ratio-fill sb-ratio-fill--b" style="width: {Math.round((score.bWins / shared.length) * 100)}%" />
          {/if}
        </div>
        <span class="sb-meta">{shared.length} Shared Topics · {score.ties} Ties</span>
      </div>

      <div class="scoreboard-side scoreboard-side--b" class:scoreboard-leader={score.leader === 'b'}>
        <span class="sb-handle">{resultB.handle}</span>
        <span class="sb-score">{score.bWins}</span>
        <span class="sb-label">topics won</span>
        <span class="sb-avg">{score.bAvg}% avg accuracy</span>
      </div>
    </div>

    <!-- Head-to-Head Stats -->
    {@const errA = getErrorRates(resultA)}
    {@const errB = getErrorRates(resultB)}
    {@const bktsA = getRatingBuckets(resultA)}
    {@const bktsB = getRatingBuckets(resultB)}
    {@const allRatings = [...new Set([...bktsA.map(b => b.rating), ...bktsB.map(b => b.rating)])].sort((a,b) => a - b)}
    {@const maxCount = Math.max(...bktsA.map(b => b.count), ...bktsB.map(b => b.count), 1)}

    <div class="extra-cards">
      <!-- Stats -->
      <div class="extra-card">
        <div class="extra-card-title">Key Stats</div>
        <div class="stats-grid">
          {#each [
            ['Total Solved',  resultA.totalSolved,                  resultB.totalSolved],
            ['Accuracy',      Math.round(resultA.overallAccuracy) + '%', Math.round(resultB.overallAccuracy) + '%'],
            ['Max Rating',    resultA.maxSolvedRating ?? '—',         resultB.maxSolvedRating ?? '—'],
            ['Contests',      resultA.totalContests,                resultB.totalContests],
          ] as [label, va, vb]}
            <div class="stat-row">
              <span class="stat-val stat-val--a" class:stat-leader={+va > +vb}>{va}</span>
              <span class="stat-label">{label}</span>
              <span class="stat-val stat-val--b" class:stat-leader={+vb > +va}>{vb}</span>
            </div>
          {/each}
        </div>
      </div>

      <!-- Error Profile -->
      <div class="extra-card">
        <div class="extra-card-title">Error Profile</div>
        <div class="error-rows">
          {#each errA as eA, i}
            {@const eB = errB[i]}
            <div class="error-row">
              <div class="err-side err-side--a">
                <div class="err-track"><div class="err-fill err-fill--a" style="width:{eA.pct}%" /></div>
                <span class="err-pct">{eA.pct}%</span>
              </div>
              <span class="err-label">{eA.label}</span>
              <div class="err-side err-side--b">
                <span class="err-pct">{eB.pct}%</span>
                <div class="err-track"><div class="err-fill err-fill--b" style="width:{eB.pct}%" /></div>
              </div>
            </div>
          {/each}
        </div>
      </div>
    </div>

    <!-- Rating Distribution -->
    {#if allRatings.length > 0}
    <div class="dist-card">
      <div class="dist-header">
        <span class="extra-card-title">Rating Distribution</span>
        <div class="dist-legend">
          <span class="dist-dot dist-dot--a"></span><span>{resultA.handle}</span>
          <span class="dist-dot dist-dot--b"></span><span>{resultB.handle}</span>
        </div>
      </div>
      <div class="dist-chart">
        {#each allRatings as rating}
          {@const cA = bktsA.find(b => b.rating === rating)?.count ?? 0}
          {@const cB = bktsB.find(b => b.rating === rating)?.count ?? 0}
          <div class="dist-col">
            <div class="dist-bars">
              <div class="dist-bar dist-bar--a" style="height:{Math.round((cA/maxCount)*80)}px" title="{resultA.handle}: {cA} solves at {rating}" />
              <div class="dist-bar dist-bar--b" style="height:{Math.round((cB/maxCount)*80)}px" title="{resultB.handle}: {cB} solves at {rating}" />
            </div>
            <span class="dist-label">{rating}</span>
          </div>
        {/each}
      </div>
    </div>
    {/if}

    <div class="results-card">
      <!-- Compact Sort Bar -->
      <div class="sort-bar">
        <span class="sort-label">Sort</span>
        <button class="sort-btn" class:sort-btn--active={sortMode === 'gap'}     on:click={() => setSortMode('gap')}     title="Biggest gap first">Gap ↓</button>
        <button class="sort-btn" class:sort-btn--active={sortMode === 'a-leads'} on:click={() => setSortMode('a-leads')} title="A leads">A▲</button>
        <button class="sort-btn" class:sort-btn--active={sortMode === 'b-leads'} on:click={() => setSortMode('b-leads')} title="B leads">B▲</button>
        <button class="sort-btn" class:sort-btn--active={sortMode === 'alpha'}   on:click={() => setSortMode('alpha')}   title="Alphabetical">A–Z</button>
      </div>

      {#if topics.length === 0}
        <div class="empty-inline">
          <p>No common topic data with ≥ 3 attempts found between these handles.</p>
        </div>
      {:else}
        <div class="compare-table">
          {#each topics as { tag, tA, tB }}
            {@const gap = Math.round(Math.abs(tA.accuracy - tB.accuracy) * 100)}
            {@const aWins = tA.accuracy > tB.accuracy}
            {@const isTie = tA.accuracy === tB.accuracy}
            <div class="compare-row">
              <!-- Left (A) -->
              <div class="cell-side cell-side--left">
                <span class="acc-val" class:acc-val--win={aWins}>
                  {Math.round(tA.accuracy * 100)}%
                </span>
                <div class="progress-track">
                  <div
                    class="progress-fill progress-fill--a"
                    style="width: {Math.round(tA.accuracy * 100)}%"
                  />
                </div>
              </div>

              <!-- Tag + gap -->
              <div class="tag-col">
                <div class="tag-badge">#{tag}</div>
                {#if isTie}
                  <span class="gap-pill gap-pill--tie">DRAW</span>
                {:else}
                  <span class="gap-pill" class:gap-pill--a={aWins} class:gap-pill--b={!aWins}>
                    {aWins ? resultA.handle : resultB.handle} +{gap}%
                  </span>
                {/if}
              </div>

              <!-- Right (B) -->
              <div class="cell-side cell-side--right">
                <div class="progress-track">
                  <div
                    class="progress-fill progress-fill--b"
                    style="width: {Math.round(tB.accuracy * 100)}%"
                  />
                </div>
                <span class="acc-val" class:acc-val--win={!aWins && !isTie}>
                  {Math.round(tB.accuracy * 100)}%
                </span>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {:else}
    <div class="state-card empty-state">
      <span class="state-icon">⚖️</span>
      <h2 class="state-title">Select two handles to compare</h2>
      <p class="state-desc">Enter any two synced handles to inspect category-by-category win rates.</p>
    </div>
  {/if}
</div>

<style>
  .compare-page {
    max-width: 1040px;
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

  /* ── Compare Card ──────────────────────────────────────────────────────── */
  .compare-card {
    background: #FFFFFF;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-clay-card);
    padding: var(--space-4) var(--space-5);
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-5);
    border: 1px solid var(--border-subtle);
    flex-wrap: wrap;
  }

  .handle-field {
    flex: 1;
    min-width: 180px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .btn-field {
    flex-shrink: 0;
    /* Push button down slightly to optically align with the input midpoint.
       The handle-field has a 15px label above the input, so offset by half that. */
    padding-top: 15px;
  }

  .field-label {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .input-clean {
    width: 100%;
    height: 38px;
    padding: 0 var(--space-3);
    background: var(--bg-inset);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    font-weight: 500;
    outline: none;
  }

  .input-clean:focus {
    background: #FFFFFF;
    border-color: var(--clay-orange);
    box-shadow: 0 0 0 3px rgba(234, 88, 12, 0.12);
  }

  .input-clean.input-error {
    border-color: #F87171;
    background: #FFF5F5;
    box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.1);
  }

  .field-error-hint {
    font-size: 11px;
    font-weight: 600;
    color: transparent;
    margin-top: 2px;
    height: 14px;
    display: block;
    transition: color 0.15s ease;
  }

  .field-error-hint.visible {
    color: #DC2626;
  }

  .vs-badge {
    width: 36px;
    height: 36px;
    border-radius: var(--radius-full);
    background: var(--clay-yellow-bg);
    border: 1px solid var(--clay-yellow-border);
    color: var(--clay-yellow-text);
    font-weight: 800;
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 0 var(--space-5);
    height: 38px;
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-fast);
    white-space: nowrap;
  }

  .btn--primary {
    background: linear-gradient(135deg, #F97316 0%, #EA580C 100%);
    color: #FFFFFF;
    box-shadow: var(--shadow-clay-btn-orange);
  }

  .btn--primary:hover:not(:disabled) {
    filter: brightness(1.06);
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .banner {
    background: #FFF1F2;
    border-radius: var(--radius-md);
    padding: var(--space-3) var(--space-4);
    color: var(--clay-red-text);
    font-size: var(--text-sm);
    font-weight: 600;
    margin-bottom: var(--space-4);
    display: flex;
    align-items: center;
    gap: var(--space-2);
    border: 1px solid var(--clay-red-border);
  }

  /* ── Scoreboard Card ───────────────────────────────────────────────────── */
  .scoreboard-card {
    background: #FFFFFF;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-clay-card);
    border: 1px solid var(--border-subtle);
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    padding: var(--space-4) var(--space-5);
    margin-bottom: var(--space-4);
    gap: var(--space-4);
  }

  .scoreboard-side {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .scoreboard-side--a { align-items: flex-start; }
  .scoreboard-side--b { align-items: flex-end; }

  .sb-handle {
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--text-secondary);
  }

  .sb-score {
    font-size: 2.4rem;
    font-weight: 800;
    line-height: 1;
    color: var(--text-primary);
    font-family: var(--font-mono);
  }

  .scoreboard-leader .sb-score {
    color: var(--clay-orange);
  }

  .scoreboard-side--b.scoreboard-leader .sb-score {
    color: var(--clay-green);
  }

  .sb-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .sb-avg {
    font-size: 11px;
    color: var(--text-muted);
    font-weight: 500;
    margin-top: 2px;
  }

  .scoreboard-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    min-width: 140px;
  }

  .sb-ratio-bar {
    width: 100%;
    height: 8px;
    border-radius: 9999px;
    overflow: hidden;
    display: flex;
    background: var(--bg-inset);
  }

  .sb-ratio-fill { height: 100%; }
  .sb-ratio-fill--a    { background: var(--clay-orange); }
  .sb-ratio-fill--tie  { background: var(--bg-overlay); }
  .sb-ratio-fill--b    { background: var(--clay-green); }

  .sb-meta {
    font-size: 11px;
    color: var(--text-muted);
    font-weight: 600;
    text-align: center;
  }

  /* ── Results Card ──────────────────────────────────────────────────────── */
  .results-card {
    background: #FFFFFF;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-clay-card);
    padding: var(--space-4) var(--space-5);
    border: 1px solid var(--border-subtle);
  }

  /* ── Sort Bar ──────────────────────────────────────────────────────────── */
  .sort-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding-bottom: var(--space-3);
    border-bottom: 1px solid var(--border-subtle);
    margin-bottom: var(--space-3);
    flex-wrap: wrap;
  }

  .sort-label {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-right: 4px;
  }

  .sort-btn {
    font-size: 11px;
    font-weight: 600;
    padding: 3px 10px;
    border-radius: 9999px;
    border: 1px solid var(--border-default);
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: var(--font-sans);
  }

  .sort-btn:hover { border-color: var(--clay-orange); color: var(--clay-orange); }

  .sort-btn--active {
    background: var(--clay-orange-bg);
    border-color: var(--clay-orange-border);
    color: var(--clay-orange-text);
  }



  .compare-table {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .compare-row {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: var(--space-3);
    background: #FAF9F6;
    padding: 8px var(--space-3);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-subtle);
  }

  .cell-side {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .progress-track {
    flex: 1;
    height: 8px;
    background: var(--bg-inset);
    border-radius: var(--radius-full);
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    border-radius: var(--radius-full);
    transition: width var(--transition-slow);
  }

  .progress-fill--a { background: var(--clay-orange); }
  .progress-fill--b { background: var(--clay-green); }

  .acc-val {
    font-size: var(--text-xs);
    font-family: var(--font-mono);
    font-weight: 600;
    color: var(--text-secondary);
    min-width: 36px;
    text-align: center;
  }

  .acc-val--win {
    color: var(--text-primary);
    font-weight: 700;
  }

  .tag-badge {
    background: #FFFFFF;
    border: 1px solid var(--border-subtle);
    padding: 2px var(--space-3);
    border-radius: var(--radius-full);
    font-size: 11px;
    font-weight: 600;
    color: var(--text-primary);
    min-width: 120px;
    text-align: center;
    white-space: nowrap;
  }

  .tag-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    min-width: 140px;
  }

  .gap-pill {
    font-size: 10px;
    font-weight: 700;
    padding: 1px 7px;
    border-radius: 9999px;
    font-family: var(--font-mono);
    white-space: nowrap;
  }

  .gap-pill--a   { background: #FFF7ED; color: #C2410C; }
  .gap-pill--b   { background: #ECFDF5; color: #065F46; }
  .gap-pill--tie { background: var(--bg-inset); color: var(--text-muted); }

  .empty-inline {
    padding: var(--space-6);
    text-align: center;
    color: var(--text-muted);
    font-size: var(--text-xs);
  }

  /* ── State Card ────────────────────────────────────────────────────────── */
  .state-card {
    background: #FFFFFF;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-clay-card);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-3);
    padding: var(--space-12) var(--space-6);
    color: var(--text-secondary);
    text-align: center;
    border: 1px solid var(--border-subtle);
  }

  .state-icon { font-size: 36px; }
  .state-title { font-size: var(--text-md); font-weight: 700; color: var(--text-primary); }
  .state-desc { font-size: var(--text-sm); color: var(--text-secondary); max-width: 400px; }
  .state-text { font-size: var(--text-sm); font-weight: 600; }

  .spinner-brand {
    width: 28px; height: 28px;
    border: 3px solid var(--bg-inset);
    border-top-color: var(--clay-orange);
    border-radius: 50%;
  }

  .spinner-mini {
    width: 14px; height: 14px;
    border: 2px solid rgba(255,255,255,0.4);
    border-top-color: #FFFFFF;
    border-radius: 50%;
  }
  /* ── Extra Cards Row ───────────────────────────────────────────────────── */
  .extra-cards {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-4);
    margin-bottom: var(--space-4);
  }

  .extra-card {
    background: #FFFFFF;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-clay-card);
    padding: var(--space-4);
  }

  .extra-card-title {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    margin-bottom: var(--space-3);
  }

  /* Key Stats */
  .stats-grid {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .stat-row {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: var(--space-2);
  }

  .stat-val {
    font-size: var(--text-sm);
    font-weight: 700;
    font-family: var(--font-mono);
    color: var(--text-secondary);
  }

  .stat-val--a { text-align: right; }
  .stat-val--b { text-align: left; }

  .stat-val.stat-leader { color: var(--text-primary); }
  .stat-val--a.stat-leader { color: var(--clay-orange-text); }
  .stat-val--b.stat-leader { color: #065F46; }

  .stat-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
    text-align: center;
    white-space: nowrap;
    background: var(--bg-inset);
    padding: 2px 8px;
    border-radius: 9999px;
  }

  /* Error Profile */
  .error-rows {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .error-row {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 8px;
  }

  .err-side {
    display: flex;
    align-items: center;
    gap: 5px;
  }

  .err-side--a { flex-direction: row-reverse; }
  .err-side--b { flex-direction: row; }

  .err-track {
    flex: 1;
    height: 6px;
    background: var(--bg-inset);
    border-radius: 9999px;
    overflow: hidden;
    min-width: 40px;
  }

  .err-fill { height: 100%; border-radius: 9999px; }
  .err-fill--a { background: var(--clay-orange); margin-left: auto; }
  .err-fill--b { background: var(--clay-green); }

  .err-pct {
    font-size: 10px;
    font-family: var(--font-mono);
    font-weight: 700;
    color: var(--text-secondary);
    min-width: 24px;
    text-align: center;
    flex-shrink: 0;
  }

  .err-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--text-muted);
    text-align: center;
    white-space: nowrap;
    background: var(--bg-inset);
    padding: 1px 6px;
    border-radius: 9999px;
  }

  /* Rating Distribution */
  .dist-card {
    background: #FFFFFF;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-clay-card);
    padding: var(--space-4);
    margin-bottom: var(--space-4);
    overflow-x: auto;
  }

  .dist-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-3);
  }

  .dist-legend {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .dist-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .dist-dot--a { background: var(--clay-orange); }
  .dist-dot--b { background: var(--clay-green); }

  .dist-chart {
    display: flex;
    align-items: flex-end;
    gap: 6px;
    padding-bottom: var(--space-2);
    min-height: 100px;
  }

  .dist-col {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .dist-bars {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 80px;
  }

  .dist-bar {
    width: 8px;
    border-radius: 2px 2px 0 0;
    min-height: 2px;
    transition: height 0.3s ease;
  }

  .dist-bar--a { background: var(--clay-orange); opacity: 0.85; }
  .dist-bar--b { background: var(--clay-green);  opacity: 0.85; }

  .dist-label {
    font-size: 9px;
    color: var(--text-muted);
    font-family: var(--font-mono);
    text-align: center;
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    height: 30px;
    white-space: nowrap;
  }

  /* Compact Sort Bar */
  .sort-bar {
    display: flex;
    align-items: center;
    gap: 4px;
    padding-bottom: var(--space-3);
    border-bottom: 1px solid var(--border-subtle);
    margin-bottom: var(--space-3);
  }

  .sort-label {
    font-size: 10px;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-right: 2px;
  }

  .sort-btn {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 9999px;
    border: 1px solid var(--border-default);
    background: transparent;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.12s ease;
    font-family: var(--font-sans);
    white-space: nowrap;
  }

  .sort-btn:hover { border-color: var(--clay-orange); color: var(--clay-orange); }

  .sort-btn--active {
    background: var(--clay-orange-bg);
    border-color: var(--clay-orange-border);
    color: var(--clay-orange-text);
  }
</style>
