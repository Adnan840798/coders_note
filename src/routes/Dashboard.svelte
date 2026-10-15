<script lang="ts">
  import { onMount } from 'svelte'
  import { contestsStore } from '../stores/contests.store'
  import type { Contest, ContestStatus } from '../../../shared/types'

  // ── Filters & View ────────────────────────────────────────────────────────
  let searchQuery = ''
  let activeTab: 'all' | ContestStatus = 'upcoming'
  let selectedPlatform = 'all'

  const PLATFORMS = [
    { id: 'all',         name: 'All' },
    { id: 'codeforces',  name: 'Codeforces' },
    { id: 'leetcode',    name: 'LeetCode' },
    { id: 'atcoder',     name: 'AtCoder' },
    { id: 'codechef',    name: 'CodeChef' },
    { id: 'hackerrank',  name: 'HackerRank' },
  ]

  onMount(() => {
    fetchContests()
  })

  function fetchContests() {
    const statusFilter = activeTab === 'all' ? undefined : [activeTab]
    const platformFilter = selectedPlatform === 'all' ? undefined : [selectedPlatform]
    contestsStore.fetch({
      search: searchQuery.trim() || undefined,
      sites:  platformFilter,
      status: statusFilter,
    })
  }

  function handleTabChange(tab: 'all' | ContestStatus) {
    activeTab = tab
    fetchContests()
  }

  function handlePlatformChange(platformId: string) {
    selectedPlatform = platformId
    fetchContests()
  }

  function formatDuration(secs: number): string {
    const h = Math.floor(secs / 3600)
    const m = Math.floor((secs % 3600) / 60)
    if (h === 0) return `${m}m`
    if (m === 0) return `${h}h`
    return `${h}h ${m}m`
  }

  function formatDateRow(ts: number): { dateStr: string; timeStr: string } {
    const d = new Date(ts * 1000)
    const dateStr = d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    const timeStr = d.toLocaleString('en-US', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
    return { dateStr, timeStr }
  }

  function timeCountdownLabel(contest: Contest): { text: string; urgent: boolean } {
    const now  = Math.floor(Date.now() / 1000)
    const diff = contest.startTime - now

    if (contest.status === 'running') {
      const remaining = (contest.startTime + contest.duration) - now
      const m = Math.floor(remaining / 60)
      const h = Math.floor(m / 60)
      const text = h > 0 ? `Ends in ${h}h ${m % 60}m` : `Ends in ${m}m`
      return { text, urgent: true }
    }

    if (diff > 0) {
      const h = Math.floor(diff / 3600)
      const d = Math.floor(h / 24)
      if (d > 1) return { text: `In ${d} days`, urgent: false }
      if (d === 1) return { text: `Tomorrow (${h % 24}h)`, urgent: false }
      if (h > 0) return { text: `In ${h}h ${Math.floor((diff % 3600) / 60)}m`, urgent: true }
      return { text: `In ${Math.floor(diff / 60)}m`, urgent: true }
    }

    return { text: 'Concluded', urgent: false }
  }

  async function toggleReminder(contest: Contest) {
    if (contest.hasReminder) {
      await contestsStore.removeReminder(contest.id)
    } else {
      const remindAt = contest.startTime - 30 * 60
      await contestsStore.setReminder(contest.id, remindAt)
    }
  }

  $: counts = {
    running:  $contestsStore.contests.filter(c => c.status === 'running').length,
    upcoming: $contestsStore.contests.filter(c => c.status === 'upcoming').length,
    total:    $contestsStore.contests.length,
  }
</script>

<div class="dashboard-page anim-fade-in">
  <!-- Page Header -->
  <header class="page-header">
    <div class="header-left">
      <h1 class="page-title">Competitive Programming Rounds</h1>
      <p class="page-subtitle">Track upcoming & live contests across major competitive programming platforms</p>
    </div>

    <button class="btn-refresh" on:click={fetchContests} id="btn-refresh-contests">
      <span class="refresh-icon" class:anim-spin={$contestsStore.loading}>↻</span>
      <span>Sync Feeds</span>
    </button>
  </header>

  <!-- Measured Master Toolbar -->
  <div class="toolbar">
    <!-- Left: Segmented Status Switcher -->
    <div class="toolbar-left">
      <div class="segmented-control" role="tablist">
        <button
          class="segmented-tab"
          class:segmented-tab--active={activeTab === 'upcoming'}
          on:click={() => handleTabChange('upcoming')}
        >
          Upcoming
        </button>

        <button
          class="segmented-tab"
          class:segmented-tab--active={activeTab === 'running'}
          on:click={() => handleTabChange('running')}
        >
          Live
          {#if counts.running > 0}
            <span class="live-pill">{counts.running}</span>
          {/if}
        </button>

        <button
          class="segmented-tab"
          class:segmented-tab--active={activeTab === 'ended'}
          on:click={() => handleTabChange('ended')}
        >
          Past
        </button>

        <button
          class="segmented-tab"
          class:segmented-tab--active={activeTab === 'all'}
          on:click={() => handleTabChange('all')}
        >
          All
        </button>
      </div>

      <!-- Platform Filter Tabs -->
      <div class="platform-tabs">
        {#each PLATFORMS as p}
          <button
            class="platform-tab"
            class:platform-tab--active={selectedPlatform === p.id}
            on:click={() => handlePlatformChange(p.id)}
          >
            {p.name}
          </button>
        {/each}
      </div>
    </div>

    <!-- Right: Compact Search Field -->
    <div class="search-box">
      <span class="search-icon">🔍</span>
      <input
        class="search-input"
        type="search"
        placeholder="Filter contests…"
        bind:value={searchQuery}
        on:input={fetchContests}
        id="input-contest-search"
      />
    </div>
  </div>

  <!-- Schedule Table View -->
  {#if $contestsStore.loading && $contestsStore.contests.length === 0}
    <div class="state-card">
      <div class="spinner-brand anim-spin" />
      <p class="state-title">Retrieving contest feeds…</p>
      <p class="state-subtitle">Checking live rounds and upcoming registered schedules</p>
    </div>
  {:else if $contestsStore.error && $contestsStore.contests.length === 0}
    <div class="state-card state-card--error">
      <p class="state-title">Unable to synchronize contest feeds</p>
      <p class="state-subtitle">{$contestsStore.error}</p>
      <button class="btn-retry" on:click={fetchContests}>Retry</button>
    </div>
  {:else if $contestsStore.contests.length === 0}
    <div class="state-card">
      <p class="state-title">No contests match your filters</p>
      <p class="state-subtitle">Try resetting the search query or switching to "All Platforms".</p>
    </div>
  {:else}
    <div class="table-container">
      <div class="table-header">
        <span class="col-date">Date & Time</span>
        <span class="col-details">Contest</span>
        <span class="col-status">Status / Countdown</span>
        <span class="col-actions">Actions</span>
      </div>

      <div class="table-body">
        {#each $contestsStore.contests as contest (contest.id)}
          {@const dateInfo = formatDateRow(contest.startTime)}
          {@const countdown = timeCountdownLabel(contest)}
          <div
            class="table-row"
            class:table-row--live={contest.status === 'running'}
          >
            <!-- Date Column -->
            <div class="col-date">
              <span class="date-primary">{dateInfo.dateStr}</span>
              <span class="date-secondary">{dateInfo.timeStr}</span>
            </div>

            <!-- Contest Details Column -->
            <div class="col-details">
              <div class="details-meta">
                <span class="platform-tag platform-tag--{contest.site}">
                  {contest.site}
                </span>
                <span class="duration-text">
                  ⏱ {formatDuration(contest.duration)}
                </span>
                {#if contest.status === 'running'}
                  <span class="live-badge">LIVE NOW</span>
                {/if}
              </div>

              <a
                href={contest.url}
                target="_blank"
                rel="noreferrer"
                class="contest-title"
                title={contest.title}
              >
                {contest.title}
              </a>
            </div>

            <!-- Status / Countdown Column -->
            <div class="col-status">
              <span
                class="countdown-tag"
                class:countdown-tag--live={contest.status === 'running'}
                class:countdown-tag--urgent={countdown.urgent}
              >
                {countdown.text}
              </span>
            </div>

            <!-- Actions Column -->
            <div class="col-actions">
              <button
                class="btn-action-reminder"
                class:btn-action-reminder--active={contest.hasReminder}
                on:click={() => toggleReminder(contest)}
                title={contest.hasReminder ? 'Reminder active (30m prior)' : 'Set reminder for 30m prior'}
                aria-label="{contest.hasReminder ? 'Remove' : 'Set'} reminder for {contest.title}"
              >
                {contest.hasReminder ? 'Reminded' : 'Remind'}
              </button>

              <a
                href={contest.url}
                target="_blank"
                rel="noreferrer"
                class="btn-action-open"
                aria-label="Open {contest.title}"
              >
                Open ↗
              </a>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .dashboard-page {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  /* ── Header ────────────────────────────────────────────────────────────── */
  .page-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    padding-bottom: 2px;
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

  .btn-refresh {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 30px;
    padding: 0 12px;
    border: 1px solid var(--border-default);
    border-radius: 6px;
    background: #FFFFFF;
    color: var(--text-secondary);
    font-family: var(--font-sans);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
    transition: all var(--transition-fast);
  }

  .btn-refresh:hover {
    background: #FAF9F5;
    color: var(--text-primary);
    border-color: var(--border-strong);
  }

  .refresh-icon {
    font-size: 13px;
    font-weight: 700;
  }

  /* ── Unified Toolbar ───────────────────────────────────────────────────── */
  .toolbar {
    background: #FFFFFF;
    border: 1px solid var(--border-subtle);
    border-radius: 10px;
    padding: 8px 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
    flex-wrap: wrap;
  }

  .toolbar-left {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  /* Segmented Status Tab */
  .segmented-control {
    background: var(--bg-inset);
    border: 1px solid var(--border-default);
    border-radius: 6px;
    padding: 2px;
    display: inline-flex;
    align-items: center;
    gap: 2px;
    height: 30px;
  }

  .segmented-tab {
    border: none;
    background: transparent;
    padding: 0 10px;
    height: 24px;
    border-radius: 4px;
    font-family: var(--font-sans);
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    transition: all var(--transition-fast);
  }

  .segmented-tab:hover:not(.segmented-tab--active) {
    color: var(--text-primary);
  }

  .segmented-tab--active {
    background: #FFFFFF;
    color: var(--text-primary);
    font-weight: 700;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
  }

  .live-pill {
    font-size: 10px;
    font-weight: 800;
    background: var(--clay-green-bg);
    color: var(--clay-green-text);
    padding: 0 5px;
    border-radius: 10px;
    line-height: 1.3;
  }

  /* Platform Filter Tabs */
  .platform-tabs {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .platform-tab {
    border: 1px solid transparent;
    background: transparent;
    padding: 0 8px;
    height: 26px;
    border-radius: 4px;
    font-family: var(--font-sans);
    font-size: 11px;
    font-weight: 600;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .platform-tab:hover {
    background: #F7F6F2;
    color: var(--text-primary);
  }

  .platform-tab--active {
    background: #FAF9F6;
    border-color: var(--border-default);
    color: var(--clay-orange-text);
    font-weight: 700;
  }

  /* Search Input */
  .search-box {
    position: relative;
    display: flex;
    align-items: center;
    width: 200px;
  }

  .search-icon {
    position: absolute;
    left: 8px;
    font-size: 11px;
    opacity: 0.5;
    pointer-events: none;
  }

  .search-input {
    width: 100%;
    height: 28px;
    padding: 0 8px 0 24px;
    background: var(--bg-inset);
    border: 1px solid var(--border-default);
    border-radius: 5px;
    color: var(--text-primary);
    font-family: var(--font-sans);
    font-size: 12px;
    font-weight: 500;
    outline: none;
    transition: all var(--transition-fast);
  }

  .search-input:focus {
    background: #FFFFFF;
    border-color: var(--clay-orange);
    box-shadow: 0 0 0 2px rgba(234, 88, 12, 0.12);
  }

  /* ── Schedule Table Container ──────────────────────────────────────────── */
  .table-container {
    background: #FFFFFF;
    border: 1px solid var(--border-subtle);
    border-radius: 10px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
    overflow: hidden;
  }

  .table-header {
    display: grid;
    grid-template-columns: 160px 1fr 140px 140px;
    align-items: center;
    padding: 0 16px;
    height: 34px;
    background: #FAF9F6;
    border-bottom: 1px solid var(--border-subtle);
    font-size: 11px;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .table-body {
    display: flex;
    flex-direction: column;
  }

  .table-row {
    display: grid;
    grid-template-columns: 160px 1fr 140px 140px;
    align-items: center;
    padding: 12px 16px;
    min-height: 58px;
    border-bottom: 1px solid var(--border-subtle);
    transition: background var(--transition-fast);
  }

  .table-row:last-child {
    border-bottom: none;
  }

  .table-row:hover {
    background: #FAF9F5;
  }

  .table-row--live {
    background: #F4FDF8;
    border-left: 3px solid var(--clay-green);
  }

  .table-row--live:hover {
    background: #EAF9F1;
  }

  /* Date Column */
  .col-date {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .date-primary {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-primary);
    font-family: var(--font-mono);
  }

  .date-secondary {
    font-size: 11px;
    color: var(--text-muted);
    font-weight: 500;
  }

  /* Details Column */
  .col-details {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding-right: 16px;
  }

  .details-meta {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .platform-tag {
    font-size: 9px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 1px 5px;
    border-radius: 3px;
    background: #F4F2EC;
    color: var(--text-secondary);
  }

  .platform-tag--codeforces { background: #FFF7ED; color: #C2410C; }
  .platform-tag--leetcode   { background: #FEF3C7; color: #92400E; }
  .platform-tag--atcoder    { background: #F3F4F6; color: #374151; }
  .platform-tag--codechef   { background: #FEF9C3; color: #713F12; }

  .duration-text {
    font-size: 11px;
    color: var(--text-muted);
    font-weight: 500;
  }

  .live-badge {
    font-size: 9px;
    font-weight: 800;
    color: var(--clay-green-text);
    background: var(--clay-green-bg);
    padding: 1px 5px;
    border-radius: 3px;
  }

  .contest-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    text-decoration: none;
    line-height: 1.35;
    transition: color var(--transition-fast);
  }

  .contest-title:hover {
    color: var(--clay-orange);
  }

  /* Status / Countdown Column */
  .col-status {
    display: flex;
    align-items: center;
  }

  .countdown-tag {
    font-size: 11px;
    font-weight: 600;
    font-family: var(--font-mono);
    color: var(--text-secondary);
    background: #FAF9F6;
    border: 1px solid var(--border-subtle);
    padding: 3px 8px;
    border-radius: 4px;
  }

  .countdown-tag--urgent {
    color: var(--clay-orange-text);
    background: var(--clay-orange-bg);
    border-color: var(--clay-orange-border);
  }

  .countdown-tag--live {
    color: var(--clay-green-text);
    background: var(--clay-green-bg);
    border-color: var(--clay-green-border);
    font-weight: 700;
  }

  /* Actions Column */
  .col-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
  }

  .btn-action-reminder {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 10px;
    height: 28px;
    border: 1px solid var(--border-default);
    border-radius: 4px;
    background: #FFFFFF;
    color: var(--text-secondary);
    font-family: var(--font-sans);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .btn-action-reminder:hover {
    background: #FAF9F5;
    border-color: var(--border-strong);
    color: var(--text-primary);
  }

  .btn-action-reminder--active {
    background: var(--clay-yellow-bg);
    border-color: var(--clay-yellow-border);
    color: var(--clay-yellow-text);
    font-weight: 700;
  }

  .btn-action-open {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 10px;
    height: 28px;
    border: 1px solid var(--border-default);
    border-radius: 4px;
    background: #FFFFFF;
    color: var(--text-primary);
    font-family: var(--font-sans);
    font-size: 11px;
    font-weight: 600;
    text-decoration: none;
    transition: all var(--transition-fast);
  }

  .btn-action-open:hover {
    background: var(--clay-orange);
    color: #FFFFFF;
    border-color: var(--clay-orange);
  }

  /* ── State Card ────────────────────────────────────────────────────────── */
  .state-card {
    background: #FFFFFF;
    border: 1px solid var(--border-subtle);
    border-radius: 10px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
    padding: 48px 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 4px;
  }

  .state-card--error {
    background: #FFF9FA;
    border-color: var(--clay-red-border);
  }

  .state-title {
    font-size: 14px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .state-subtitle {
    font-size: 12px;
    color: var(--text-secondary);
    max-width: 400px;
  }

  .spinner-brand {
    width: 24px;
    height: 24px;
    border: 2px solid var(--bg-inset);
    border-top-color: var(--clay-orange);
    border-radius: 50%;
    margin-bottom: 8px;
  }

  .btn-retry {
    margin-top: 10px;
    padding: 4px 12px;
    border: none;
    border-radius: 4px;
    background: var(--clay-orange);
    color: #FFFFFF;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
  }
</style>
