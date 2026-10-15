<script lang="ts">
  import { onMount } from 'svelte'
  import { profileStore } from '../stores/profile.store'
  import { settings } from '../stores/settings.store'
  import type { Platform, AnalysisResult, RatingChange } from '../../../shared/types'
  
  import ActivityHeatmap from '../components/ActivityHeatmap.svelte'
  import CoachInsights from '../components/CoachInsights.svelte'

  let handleInput = ''
  let platform: Platform = 'codeforces'

  onMount(async () => {
    await profileStore.loadSavedHandles()
    if ($settings.defaultHandle) {
      const [p, u] = $settings.defaultHandle.split(':')
      if (u) await profileStore.load(p as Platform, u)
    }
  })

  // Ensure analysis is fetched if profile exists but analysis is missing
  $: if ($profileStore.profile && !$profileStore.analysis && !$profileStore.loading && !$profileStore.syncing && !$profileStore.error) {
    profileStore.load($profileStore.platform, $profileStore.profile.handle)
  }

  async function handleSync() {
    const target = handleInput.trim() || $profileStore.profile?.handle
    if (!target) return
    profileStore.clearError()
    await profileStore.sync(platform, target)
    handleInput = ''
  }

  function getRatingColor(rating: number | null): string {
    if (!rating) return 'var(--rating-newbie)'
    if (rating >= 3000) return 'var(--rating-legendary)'
    if (rating >= 2400) return 'var(--rating-gm)'
    if (rating >= 2100) return 'var(--rating-master)'
    if (rating >= 1900) return 'var(--rating-cm)'
    if (rating >= 1600) return 'var(--rating-expert)'
    if (rating >= 1400) return 'var(--rating-specialist)'
    if (rating >= 1200) return 'var(--rating-pupil)'
    return 'var(--rating-newbie)'
  }

  function sortedRatingBuckets(solvesByRating: Record<string, number>): { rating: number; count: number; max: number }[] {
    const entries = Object.entries(solvesByRating ?? {})
      .map(([r, count]) => ({ rating: Number(r), count }))
      .filter(item => !isNaN(item.rating) && item.rating > 0)
      .sort((a, b) => a.rating - b.rating)

    const maxCount = entries.reduce((max, cur) => cur.count > max ? cur.count : max, 1)
    return entries.map(e => ({ ...e, max: maxCount }))
  }

  function getComputedMetrics(a: AnalysisResult | null, ratingHistory: RatingChange[] | undefined) {
    if (!a) return null

    const solvesByRating = a.solvesByRating ?? {}
    const verdictBreakdown = a.verdictBreakdown ?? ({} as Record<string, number>)

    // Total Solved & Submissions
    const totalSolved = a.totalSolved ?? Object.values(solvesByRating).reduce((acc, v) => acc + v, 0) ?? verdictBreakdown['OK'] ?? 0
    const totalSubs = a.totalSubmissions ?? Object.values(verdictBreakdown).reduce((acc, v) => acc + v, 0) ?? totalSolved
    const accuracy = totalSubs > 0
      ? Math.round(((verdictBreakdown['OK'] ?? totalSolved) / totalSubs) * 100)
      : (a.overallAccuracy ? Math.round(a.overallAccuracy) : 0)

    // Hardest problem solved
    const ratings = Object.keys(solvesByRating).map(Number).filter(n => !isNaN(n) && n > 0)
    const maxSolvedRating = a.maxSolvedRating ?? (ratings.length > 0 ? Math.max(...ratings) : null)

    // Most solved rating bucket
    let mostSolvedRating = a.mostSolvedRating
    if (!mostSolvedRating && Object.keys(solvesByRating).length > 0) {
      const top = Object.entries(solvesByRating).sort((x, y) => y[1] - x[1])[0]
      if (top) mostSolvedRating = { rating: top[0], count: top[1] }
    }

    // Best contest rank
    const history = ratingHistory ?? []
    let bestRank = a.bestContestRank
    let totalContests = a.totalContests ?? history.length
    if (!bestRank && history.length > 0) {
      const best = history.reduce((min, cur) => cur.rank < min.rank ? cur : min, history[0])
      bestRank = { rank: best.rank, contestName: best.contestName, contestId: best.contestId }
      totalContests = history.length
    }

    return {
      totalSolved,
      totalSubs,
      accuracy,
      maxSolvedRating,
      mostSolvedRating,
      bestRank,
      totalContests,
    }
  }

  function getAvatarUrl(url: string | undefined | null): string {
    if (!url) return ''
    let clean = url.trim()
    if (clean.startsWith('//')) clean = 'https:' + clean
    clean = clean.replace(/^http:\/\//i, 'https://')
    return clean.replace(/^https?:\/\/userpic\.codeforces\.org\//i, 'https://codeforces.com/userpic/')
  }

  function handleAvatarError(e: Event, handle: string) {
    const img = e.currentTarget as HTMLImageElement
    img.style.display = 'none'
    const box = img.parentElement
    if (box) {
      box.setAttribute('data-initials', handle.slice(0, 2).toUpperCase())
      box.classList.add('avatar-fallback')
    }
  }

  function handleAvatarLoad(e: Event) {
    const img = e.currentTarget as HTMLImageElement
    img.style.display = 'block'
  }
</script>

<div class="profile-page anim-fade-in">
  <header class="page-header">
    <div>
      <h1 class="page-title">Profile Analytics</h1>
      <p class="page-subtitle">Track competitive programming performance, contest ranks, rating distributions, and topic proficiencies</p>
    </div>
  </header>

  <!-- Sync Input Bar -->
  <div class="sync-card">
    <div class="select-wrapper">
      <select class="select-clean" bind:value={platform} id="select-platform" aria-label="Platform">
        <option value="codeforces">Codeforces</option>
        <option value="leetcode" disabled>LeetCode (soon)</option>
        <option value="atcoder" disabled>AtCoder (soon)</option>
      </select>
    </div>

    <div class="input-wrapper">
      <input
        class="input-clean"
        type="text"
        placeholder="Enter Codeforces handle (e.g. tourist, Benq)…"
        bind:value={handleInput}
        on:keydown={(e) => e.key === 'Enter' && handleSync()}
        id="input-handle"
        aria-label="Codeforces handle"
      />
    </div>

    <button
      class="btn btn--primary"
      on:click={handleSync}
      disabled={$profileStore.syncing || (!handleInput.trim() && !$profileStore.profile)}
      id="btn-sync-profile"
    >
      {#if $profileStore.syncing}
        <span class="spinner-mini anim-spin" />
        <span>Syncing…</span>
      {:else}
        <span>↻ Sync Profile</span>
      {/if}
    </button>
  </div>

  {#if $profileStore.error}
    <div class="banner banner--error" role="alert">
      <span class="banner-icon">⚠</span>
      <span class="banner-msg">{$profileStore.error}</span>
      <button class="banner-dismiss" on:click={() => profileStore.clearError()} aria-label="Dismiss">✕</button>
    </div>
  {/if}

  {#if $profileStore.loading}
    <div class="state-card">
      <div class="spinner-brand anim-spin" />
      <p class="state-title">Loading profile metrics…</p>
      <p class="state-subtitle">Computing rating history, solve distributions, and topic accuracies</p>
    </div>
  {:else if $profileStore.profile}
    {@const p = $profileStore.profile}
    {@const a = $profileStore.analysis}
    {@const m = getComputedMetrics(a, $profileStore.ratingHistory)}

    <!-- Profile Hero Card -->
    <div class="profile-hero">
      <div
        class="avatar-box"
        data-initials={p.handle.slice(0, 2).toUpperCase()}
      >
        {#if getAvatarUrl(p.avatar)}
          <img
            src={getAvatarUrl(p.avatar)}
            alt="{p.handle} avatar"
            class="avatar-img"
            on:error={(e) => handleAvatarError(e, p.handle)}
            on:load={handleAvatarLoad}
          />
        {/if}
      </div>

      <div class="profile-hero__meta">
        <div class="handle-row">
          <h2 class="handle-title" style="color: {getRatingColor(p.rating)}">
            {p.handle}
          </h2>
          <span class="rank-pill">{p.rank ?? 'Unrated'}</span>
        </div>
        <div class="sub-meta-row">
          {#if p.organization}
            <span class="org-text">{p.organization}</span>
          {/if}
          {#if p.country}
            <span class="country-text">• {p.country}</span>
          {/if}
        </div>
      </div>

      <!-- Hero Core Stat Capsules -->
      <div class="stats-pills">
        <div class="stat-capsule">
          <span class="capsule-label">Current Rating</span>
          <span class="capsule-val" style="color: {getRatingColor(p.rating)}">{p.rating ?? '—'}</span>
        </div>

        <div class="stat-capsule">
          <span class="capsule-label">Max Rating</span>
          <span class="capsule-val" style="color: {getRatingColor(p.maxRating)}">{p.maxRating ?? '—'}</span>
        </div>

        <div class="stat-capsule">
          <span class="capsule-label">Contribution</span>
          <span class="capsule-val">{p.contribution >= 0 ? '+' : ''}{p.contribution}</span>
        </div>
      </div>
    </div>

    <!-- Key Performance Measurements Bar (4 Metric Cards) -->
    {#if m}
      <div class="kpi-grid">
        <!-- Most Solved Rating -->
        <div class="kpi-card">
          <span class="kpi-label">Most Solved Rating</span>
          <div class="kpi-val-group">
            <span class="kpi-val">{m.mostSolvedRating ? `${m.mostSolvedRating.rating}` : '—'}</span>
            {#if m.mostSolvedRating}
              <span class="kpi-sub">({m.mostSolvedRating.count} solves)</span>
            {/if}
          </div>
          <span class="kpi-desc">Most frequent problem difficulty</span>
        </div>

        <!-- Hardest Problem Solved -->
        <div class="kpi-card">
          <span class="kpi-label">Hardest Problem Solved</span>
          <div class="kpi-val-group">
            <span class="kpi-val" style="color: var(--clay-orange);">{m.maxSolvedRating ? `★ ${m.maxSolvedRating}` : '—'}</span>
          </div>
          <span class="kpi-desc">Peak problem rating solved</span>
        </div>

        <!-- Best Contest Rank -->
        <div class="kpi-card">
          <span class="kpi-label">Best Contest Rank</span>
          <div class="kpi-val-group">
            <span class="kpi-val" style="color: var(--clay-green);">{m.bestRank ? `Rank ${m.bestRank.rank}` : '—'}</span>
          </div>
          <span class="kpi-desc truncate" title={m.bestRank?.contestName ?? ''}>
            {m.bestRank ? m.bestRank.contestName : `${m.totalContests} contests participated`}
          </span>
        </div>

        <!-- Total Solved & Accuracy -->
        <div class="kpi-card">
          <span class="kpi-label">Total Unique Solved</span>
          <div class="kpi-val-group">
            <span class="kpi-val">{m.totalSolved}</span>
            <span class="kpi-sub">({m.accuracy}% AC)</span>
          </div>
          <span class="kpi-desc">{m.totalSubs} total submissions</span>
        </div>
      </div>

      {#if a}
        <CoachInsights
          analysis={a}
          totalSolved={m.totalSolved}
          totalSubs={m.totalSubs}
        />
        
        {#if a.dailySolves && Object.keys(a.dailySolves).length > 0}
          <ActivityHeatmap dailySolves={a.dailySolves} />
        {/if}
      {/if}

      <!-- Problem Solves by Rating Band (Visual Histogram) -->
      {#if a && Object.keys(a.solvesByRating).length > 0}
        {@const buckets = sortedRatingBuckets(a.solvesByRating)}
        <div class="chart-card">
          <div class="card-header-clean">
            <h3 class="card-title-clean">Problem Solves by Rating</h3>
            <span class="card-count-clean">{buckets.length} difficulty bands</span>
          </div>

          <div class="rating-histogram">
            {#each buckets as b}
              <div class="histogram-col">
                <span class="histogram-count">{b.count}</span>
                <div class="histogram-track">
                  <div
                    class="histogram-fill"
                    style="height: {Math.max(4, Math.round(Math.sqrt(b.count / b.max) * 100))}%"
                    title="{b.rating} Rating: {b.count} solves"
                  />
                </div>
                <span class="histogram-label">{b.rating}</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Topic Strengths & Weaknesses Grid -->
      {#if a}
        <div class="analysis-grid">
          <!-- Weak Topics (< 40% accuracy) -->
          <div class="analysis-panel analysis-panel--weak">
            <div class="panel-header">
              <h3 class="panel-title">Weak Topics (&lt; 40% accuracy)</h3>
              <span class="panel-count">{a.weakTopics.length} detected</span>
            </div>

            {#if a.weakTopics.length === 0}
              <div class="panel-empty">
                <p>No weak topics detected (minimum 3 attempts per tag).</p>
              </div>
            {:else}
              <ul class="topic-list">
                {#each a.weakTopics.slice(0, 10) as t}
                  <li class="topic-item">
                    <span class="topic-name">#{t.tag}</span>
                    <span class="accuracy-badge accuracy-badge--weak">
                      {Math.round(t.accuracy * 100)}% ({t.solved}/{t.attempts})
                    </span>
                  </li>
                {/each}
              </ul>
            {/if}
          </div>

          <!-- Strong Topics (≥ 80% accuracy) -->
          <div class="analysis-panel analysis-panel--strong">
            <div class="panel-header">
              <h3 class="panel-title">Strong Topics (≥ 80% accuracy)</h3>
              <span class="panel-count">{a.strongTopics.length} detected</span>
            </div>

            {#if a.strongTopics.length === 0}
              <div class="panel-empty">
                <p>Solve more problems in specific categories to establish strong proficiencies.</p>
              </div>
            {:else}
              <ul class="topic-list">
                {#each a.strongTopics.slice(0, 10) as t}
                  <li class="topic-item">
                    <span class="topic-name">#{t.tag}</span>
                    <span class="accuracy-badge accuracy-badge--strong">
                      {Math.round(t.accuracy * 100)}% ({t.solved}/{t.attempts})
                    </span>
                  </li>
                {/each}
              </ul>
            {/if}
          </div>
        </div>
      {/if}
    {:else}
      <div class="state-card" style="margin-top: 8px;">
        <div class="spinner-brand anim-spin" />
        <p class="state-title">Computing comprehensive analytics for {p.handle}…</p>
        <p class="state-subtitle">Calculating solve ratings, best contest ranks, topic proficiencies, and submission metrics</p>
      </div>
    {/if}

  {:else}
    <div class="state-card empty-state">
      <h2 class="state-title">No profile loaded</h2>
      <p class="state-subtitle">Enter your Codeforces handle above and click Sync Profile to compute comprehensive contest and solve analytics.</p>
    </div>
  {/if}
</div>

<style>
  .profile-page {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .page-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
  }

  .page-title {
    font-size: 18px;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.02em;
    line-height: 1.2;
  }

  .page-subtitle {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary);
    margin-top: 2px;
  }

  /* ── Sync Bar ──────────────────────────────────────────────────────────── */
  .sync-card {
    background: #FFFFFF;
    border: 1px solid var(--border-subtle);
    border-radius: 10px;
    padding: 8px 12px;
    display: flex;
    gap: 8px;
    align-items: center;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
    flex-wrap: wrap;
  }

  .select-wrapper {
    min-width: 120px;
  }

  .select-clean {
    width: 100%;
    height: 32px;
    padding: 0 8px;
    background: var(--bg-inset);
    border: 1px solid var(--border-default);
    border-radius: 5px;
    color: var(--text-primary);
    font-family: var(--font-sans);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    outline: none;
  }

  .input-wrapper {
    flex: 1;
    min-width: 220px;
  }

  .input-clean {
    width: 100%;
    height: 32px;
    padding: 0 10px;
    background: var(--bg-inset);
    border: 1px solid var(--border-default);
    border-radius: 5px;
    color: var(--text-primary);
    font-family: var(--font-sans);
    font-size: 12px;
    font-weight: 500;
    outline: none;
  }

  .input-clean:focus {
    background: #FFFFFF;
    border-color: var(--clay-orange);
    box-shadow: 0 0 0 2px rgba(234, 88, 12, 0.12);
  }

  .banner {
    background: #FFF1F2;
    border-radius: 6px;
    padding: 10px 14px;
    color: var(--clay-red-text);
    font-size: 13px;
    font-weight: 600;
    border: 1px solid var(--clay-red-border);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .banner-icon {
    flex-shrink: 0;
    font-size: 14px;
  }

  .banner-msg {
    flex: 1;
  }

  .banner-dismiss {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--clay-red-text);
    font-size: 13px;
    padding: 0 2px;
    opacity: 0.6;
    line-height: 1;
    flex-shrink: 0;
  }

  .banner-dismiss:hover {
    opacity: 1;
  }

  /* ── Profile Hero Card ─────────────────────────────────────────────────── */
  .profile-hero {
    background: #FFFFFF;
    border: 1px solid var(--border-subtle);
    border-radius: 10px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.02);
    padding: 16px 20px;
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }

  .avatar-box {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    border: 2px solid var(--border-default);
    overflow: hidden;
    flex-shrink: 0;
    background: linear-gradient(135deg, #F97316 0%, #EA580C 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  .avatar-box::after {
    content: attr(data-initials);
    color: #fff;
    font-size: 18px;
    font-weight: 700;
    font-family: var(--font-sans);
    letter-spacing: 0.02em;
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    position: relative;
    z-index: 1;
    display: block;
    background: transparent;
  }


  .profile-hero__meta {
    flex: 1;
    min-width: 180px;
  }

  .handle-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .handle-title {
    font-size: 17px;
    font-weight: 700;
  }

  .rank-pill {
    background: #FAF9F6;
    border: 1px solid var(--border-subtle);
    padding: 1px 8px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-secondary);
    text-transform: capitalize;
  }

  .sub-meta-row {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--text-secondary);
    margin-top: 2px;
  }

  .stats-pills {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .stat-capsule {
    min-width: 90px;
    padding: 6px 12px;
    border-radius: 6px;
    background: #FAF9F6;
    border: 1px solid var(--border-subtle);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .capsule-val {
    font-size: 15px;
    font-weight: 700;
    font-family: var(--font-mono);
    color: var(--text-primary);
  }

  .capsule-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  /* ── KPI Grid ──────────────────────────────────────────────────────────── */
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }

  .kpi-card {
    background: #FFFFFF;
    border: 1px solid var(--border-subtle);
    border-radius: 10px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .kpi-label {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .kpi-val-group {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }

  .kpi-val {
    font-size: 18px;
    font-weight: 800;
    font-family: var(--font-mono);
    color: var(--text-primary);
  }

  .kpi-sub {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .kpi-desc {
    font-size: 11px;
    color: var(--text-secondary);
    font-weight: 500;
  }

  /* ── Rating Histogram ──────────────────────────────────────────────────── */
  .chart-card {
    background: #FFFFFF;
    border: 1px solid var(--border-subtle);
    border-radius: 10px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .card-header-clean {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--border-subtle);
    padding-bottom: 8px;
  }

  .card-title-clean {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .card-count-clean {
    font-size: 11px;
    color: var(--text-muted);
    font-weight: 600;
  }

  .rating-histogram {
    display: flex;
    align-items: flex-end;
    justify-content: flex-start;
    gap: 0;
    height: 120px;
    padding-top: 16px;
    overflow-x: auto;
    padding-bottom: 16px;
  }

  .histogram-col {
    width: 52px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    height: 100%;
    justify-content: flex-end;
  }

  .histogram-count {
    font-size: 10px;
    font-family: var(--font-mono);
    font-weight: 700;
    color: var(--text-muted);
  }

  .histogram-track {
    width: 100%;
    height: 70px;
    background: transparent;
    border-bottom: 1px solid var(--border-subtle);
    display: flex;
    justify-content: center;
    align-items: flex-end;
  }

  .histogram-fill {
    width: 32px;
    background: var(--clay-orange);
    opacity: 0.85;
    border-radius: 2px 2px 0 0;
    transition: height 0.3s ease, opacity 0.2s ease;
    min-height: 2px;
  }

  .histogram-col:hover .histogram-fill {
    opacity: 1;
  }

  .histogram-label {
    font-size: 10px;
    font-family: var(--font-mono);
    font-weight: 600;
    color: var(--text-secondary);
  }

  /* ── Analysis Grid ─────────────────────────────────────────────────────── */
  .analysis-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .analysis-panel {
    background: #FFFFFF;
    border: 1px solid var(--border-subtle);
    border-radius: 10px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .panel-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .panel-count {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
  }

  .topic-list {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .topic-item {
    background: #FAF9F6;
    border: 1px solid var(--border-subtle);
    border-radius: 5px;
    padding: 6px 10px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .topic-name {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .accuracy-badge {
    font-size: 11px;
    font-family: var(--font-mono);
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 3px;
  }

  .accuracy-badge--weak {
    background: var(--clay-red-bg);
    color: var(--clay-red-text);
  }

  .accuracy-badge--strong {
    background: var(--clay-green-bg);
    color: var(--clay-green-text);
  }

  .panel-empty {
    padding: 24px;
    text-align: center;
    color: var(--text-muted);
    font-size: 12px;
  }

  /* ── Buttons ───────────────────────────────────────────────────────────── */
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 14px;
    height: 32px;
    border: 1px solid transparent;
    border-radius: 5px;
    font-family: var(--font-sans);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-fast);
    white-space: nowrap;
  }

  .btn--primary {
    background: var(--clay-orange);
    color: #FFFFFF;
    box-shadow: 0 1px 2px rgba(234, 88, 12, 0.2);
  }

  .btn--primary:hover:not(:disabled) {
    background: var(--clay-orange-hover);
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* ── State Card ────────────────────────────────────────────────────────── */
  .state-card {
    background: #FFFFFF;
    border: 1px solid var(--border-subtle);
    border-radius: 10px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 48px 24px;
    text-align: center;
  }

  .state-title { font-size: 14px; font-weight: 700; color: var(--text-primary); }
  .state-subtitle { font-size: 12px; color: var(--text-secondary); max-width: 400px; }

  .spinner-brand {
    width: 24px; height: 24px;
    border: 2px solid var(--bg-inset);
    border-top-color: var(--clay-orange);
    border-radius: 50%;
    margin-bottom: 8px;
  }

  .spinner-mini {
    width: 12px; height: 12px;
    border: 2px solid rgba(255,255,255,0.4);
    border-top-color: #FFFFFF;
    border-radius: 50%;
    margin-right: 4px;
  }

  @media (max-width: 900px) {
    .kpi-grid { grid-template-columns: 1fr 1fr; }
    .analysis-grid { grid-template-columns: 1fr; }
  }
</style>
