<script lang="ts">
  import { onMount } from 'svelte'
  import { api } from '../lib/api'
  import type { Resource, ResourceFilter, Difficulty, ResourceType } from '../../shared/types'

  let resources: Resource[] = []
  let loading = false
  let error: string | null = null
  let search = ''
  let selectedTopic   = ''
  let selectedDiff: Difficulty | '' = ''
  let selectedType: ResourceType | '' = ''
  let bookmarkedOnly  = false

  const DIFFICULTIES: Difficulty[] = ['beginner', 'intermediate', 'advanced']
  const TYPES: ResourceType[]      = ['article', 'video', 'problem-set', 'book', 'course']

  async function loadResources() {
    loading = true
    error = null
    const filter: ResourceFilter = {
      search:         search || undefined,
      topic:          selectedTopic || undefined,
      difficulty:     selectedDiff  || undefined,
      type:           selectedType  || undefined,
      bookmarkedOnly: bookmarkedOnly || undefined,
    }
    const res = await api.getResources(filter)
    if (res.ok) resources = res.data
    else error = res.error
    loading = false
  }

  onMount(loadResources)

  async function toggleBookmark(r: Resource) {
    if (r.isBookmarked) await api.unbookmarkResource(r.id)
    else await api.bookmarkResource(r.id)
    resources = resources.map(x => x.id === r.id ? { ...x, isBookmarked: !x.isBookmarked } : x)
  }

  const TYPE_ICONS: Record<ResourceType, string> = {
    article:       '📄',
    video:         '🎥',
    'problem-set': '📋',
    book:          '📖',
    course:        '🎓',
  }
</script>

<div class="resources-page anim-fade-in">
  <header class="page-header">
    <h1 class="page-title">Curated Resources</h1>
    <p class="subtitle">Categorised algorithmic tutorials, curated problem sheets, and reference materials</p>
  </header>

  <!-- Filter Bar -->
  <div class="filters-card">
    <div class="input-wrapper">
      <span class="input-icon">🔍</span>
      <input
        class="input-clean"
        type="search"
        placeholder="Search resources, tags…"
        bind:value={search}
        on:input={loadResources}
        id="input-resource-search"
        aria-label="Search resources"
      />
    </div>

    <div class="select-wrapper">
      <select class="select-clean" bind:value={selectedDiff} on:change={loadResources} id="filter-difficulty" aria-label="Filter by difficulty">
        <option value="">All Difficulties</option>
        {#each DIFFICULTIES as d}
          <option value={d}>{d.toUpperCase()}</option>
        {/each}
      </select>
    </div>

    <div class="select-wrapper">
      <select class="select-clean" bind:value={selectedType} on:change={loadResources} id="filter-type" aria-label="Filter by type">
        <option value="">All Formats</option>
        {#each TYPES as t}
          <option value={t}>{t.toUpperCase()}</option>
        {/each}
      </select>
    </div>

    <label class="toggle-pill-label" for="filter-bookmarked">
      <input type="checkbox" id="filter-bookmarked" bind:checked={bookmarkedOnly} on:change={loadResources} />
      <span class="toggle-track" />
      <span class="toggle-caption">Bookmarked</span>
    </label>
  </div>

  {#if loading}
    <div class="state-card">
      <div class="spinner-brand anim-spin" />
      <p class="state-text">Loading resource library…</p>
    </div>
  {:else if error}
    <div class="banner banner--error">
      <span>⚠️</span>
      <span>{error}</span>
    </div>
  {:else if resources.length === 0}
    <div class="state-card empty-state">
      <span class="state-icon">📚</span>
      <h2 class="state-title">No resources match your filters</h2>
      <p class="state-desc">Try resetting your search query or broadening the difficulty selector.</p>
    </div>
  {:else}
    <div class="resources-grid">
      {#each resources as r (r.id)}
        <div class="resource-card">
          <div class="resource-card__header">
            <span class="type-badge">
              {TYPE_ICONS[r.type]} {r.type}
            </span>
            <span class="diff-badge diff-badge--{r.difficulty}">
              {r.difficulty}
            </span>
          </div>

          <h2 class="resource-card__title">{r.title}</h2>

          {#if r.description}
            <p class="resource-card__desc">{r.description}</p>
          {/if}

          <div class="resource-card__footer">
            <span class="topic-tag">#{r.topic}</span>

            <div class="actions-row">
              <button
                class="btn-icon"
                class:btn-icon--active={r.isBookmarked}
                on:click={() => toggleBookmark(r)}
                aria-label="{r.isBookmarked ? 'Remove bookmark' : 'Bookmark'} {r.title}"
                title="{r.isBookmarked ? 'Remove bookmark' : 'Bookmark'}"
              >
                {r.isBookmarked ? '⭐' : '☆'}
              </button>

              <button
                class="btn btn--outline btn--sm"
                on:click={() => window.open(r.url, '_blank')}
                aria-label="Open {r.title}"
              >
                Open ↗
              </button>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .resources-page {
    max-width: 1140px;
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

  /* ── Filter Bar ─────────────────────────────────────────────────────────── */
  .filters-card {
    background: #FFFFFF;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-clay-card);
    padding: var(--space-3) var(--space-4);
    display: flex;
    gap: var(--space-3);
    align-items: center;
    margin-bottom: var(--space-5);
    border: 1px solid var(--border-subtle);
    flex-wrap: wrap;
  }

  .input-wrapper {
    position: relative;
    flex: 1;
    min-width: 220px;
    display: flex;
    align-items: center;
  }

  .input-icon {
    position: absolute;
    left: var(--space-3);
    font-size: 13px;
    pointer-events: none;
    opacity: 0.6;
  }

  .input-clean {
    width: 100%;
    height: 38px;
    padding: 0 var(--space-3) 0 calc(var(--space-3) + 20px);
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

  .select-wrapper {
    min-width: 140px;
  }

  .select-clean {
    width: 100%;
    height: 38px;
    padding: 0 var(--space-3);
    background: var(--bg-inset);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    font-weight: 700;
    cursor: pointer;
    outline: none;
  }

  .toggle-pill-label {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    cursor: pointer;
    user-select: none;
  }

  .toggle-pill-label input {
    opacity: 0;
    width: 0;
    height: 0;
    position: absolute;
  }

  .toggle-track {
    width: 36px;
    height: 20px;
    border-radius: var(--radius-full);
    background: var(--bg-inset);
    border: 1px solid var(--border-default);
    position: relative;
    transition: all var(--transition-fast);
  }

  .toggle-track::after {
    content: '';
    position: absolute;
    width: 14px;
    height: 14px;
    border-radius: var(--radius-full);
    background: #FFFFFF;
    box-shadow: 0 1px 2px rgba(0,0,0,0.2);
    top: 2px;
    left: 2px;
    transition: transform var(--transition-fast);
  }

  .toggle-pill-label input:checked + .toggle-track {
    background: var(--clay-orange);
    border-color: var(--clay-orange);
  }

  .toggle-pill-label input:checked + .toggle-track::after {
    transform: translateX(16px);
  }

  .toggle-caption {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--text-secondary);
  }

  /* ── Grid & Cards ──────────────────────────────────────────────────────── */
  .resources-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: var(--space-4);
  }

  .resource-card {
    background: #FFFFFF;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-clay-card);
    padding: var(--space-5);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    border: 1px solid var(--border-subtle);
    transition: all var(--transition-normal);
  }

  .resource-card:hover {
    box-shadow: var(--shadow-clay-card-hover);
    transform: translateY(-2px);
    border-color: var(--border-default);
  }

  .resource-card__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .type-badge {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-secondary);
    background: #FAF9F6;
    border: 1px solid var(--border-subtle);
    padding: 2px var(--space-2);
    border-radius: var(--radius-sm);
    text-transform: capitalize;
  }

  .diff-badge {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding: 2px var(--space-2);
    border-radius: var(--radius-full);
  }

  .diff-badge--beginner {
    background: var(--clay-green-bg);
    color: var(--clay-green-text);
  }

  .diff-badge--intermediate {
    background: var(--clay-yellow-bg);
    color: var(--clay-yellow-text);
  }

  .diff-badge--advanced {
    background: var(--clay-orange-bg);
    color: var(--clay-orange-text);
  }

  .resource-card__title {
    font-size: var(--text-md);
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1.4;
  }

  .resource-card__desc {
    font-size: var(--text-xs);
    color: var(--text-secondary);
    line-height: 1.5;
    font-weight: 500;
    flex: 1;
  }

  .resource-card__footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: auto;
    padding-top: var(--space-3);
    border-top: 1px solid var(--border-subtle);
  }

  .topic-tag {
    font-size: 11px;
    font-weight: 600;
    color: var(--clay-orange);
    background: var(--clay-orange-bg);
    padding: 2px var(--space-2);
    border-radius: var(--radius-sm);
  }

  .actions-row {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }

  .btn-icon {
    width: 28px;
    height: 28px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-default);
    background: #FFFFFF;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    color: var(--text-secondary);
    transition: all var(--transition-fast);
  }

  .btn-icon:hover {
    background: #F7F6F2;
  }

  .btn-icon--active {
    background: var(--clay-yellow-bg);
    border-color: var(--clay-yellow-border);
    color: var(--clay-yellow-text);
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 5px var(--space-3);
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    font-family: var(--font-sans);
    font-size: var(--text-xs);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

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
</style>
