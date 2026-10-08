<script lang="ts">
  import { onMount } from 'svelte'
  import { settings } from './stores/settings.store'
  import { windowControls } from './lib/api'

  // Route components
  import Dashboard  from './routes/Dashboard.svelte'
  import Profile    from './routes/Profile.svelte'
  import Compare    from './routes/Compare.svelte'
  import Resources  from './routes/Resources.svelte'
  import Practice   from './routes/Practice.svelte'
  import Settings   from './routes/Settings.svelte'

  type Route = 'dashboard' | 'profile' | 'compare' | 'resources' | 'practice' | 'settings'
  let currentRoute: Route = 'dashboard'

  function navigate(route: Route) {
    currentRoute = route
  }

  onMount(async () => {
    await settings.load()
  })

  const NAV_ITEMS: { id: Route; label: string }[] = [
    { id: 'dashboard',  label: 'Contests' },
    { id: 'profile',    label: 'Profile' },
    { id: 'compare',    label: 'Compare' },
    { id: 'resources',  label: 'Resources' },
    { id: 'practice',   label: 'Practice' },
    { id: 'settings',   label: 'Settings' },
  ]
</script>

<!-- Custom Titlebar (drag region + window controls) -->
<div class="titlebar" data-tauri-drag-region>
  <div class="titlebar__brand">
    <span class="titlebar__title">Coders Note</span>
  </div>
  <div class="titlebar__drag" />
  <div class="titlebar__controls">
    <button on:click={windowControls.minimize} class="titlebar__btn" title="Minimise" aria-label="Minimise">─</button>
    <button on:click={windowControls.maximize} class="titlebar__btn" title="Maximise" aria-label="Maximise">□</button>
    <button on:click={windowControls.close}    class="titlebar__btn titlebar__btn--close" title="Close" aria-label="Close">✕</button>
  </div>
</div>

<!-- App Shell (Seamless Full-Height Desktop Grid) -->
<div class="app-shell">

  <!-- Full-Height Docked Sidebar -->
  <aside class="sidebar">
    <div class="sidebar__header">
      <span class="sidebar__brand-name">Coders Note</span>
      <span class="sidebar__brand-tag">CP Assistant</span>
    </div>

    <nav class="sidebar__nav-wrapper" aria-label="Main navigation">
      <ul class="sidebar__nav" role="list">
        {#each NAV_ITEMS as item}
          <li>
            <button
              class="sidebar__item"
              class:sidebar__item--active={currentRoute === item.id}
              on:click={() => navigate(item.id)}
              aria-current={currentRoute === item.id ? 'page' : undefined}
              id="nav-{item.id}"
            >
              <span class="sidebar__item-label">{item.label}</span>
            </button>
          </li>
        {/each}
      </ul>
    </nav>
  </aside>

  <!-- Main Scrollable Workspace -->
  <main class="main-content" id="main-content">
    {#if currentRoute === 'dashboard'}
      <Dashboard />
    {:else if currentRoute === 'profile'}
      <Profile />
    {:else if currentRoute === 'compare'}
      <Compare />
    {:else if currentRoute === 'resources'}
      <Resources />
    {:else if currentRoute === 'practice'}
      <Practice />
    {:else if currentRoute === 'settings'}
      <Settings />
    {/if}
  </main>

</div>

<style>
  /* ── Titlebar ──────────────────────────────────────────────────────────── */
  .titlebar {
    height: 36px;
    background: #FAF9F6;
    border-bottom: 1px solid rgba(220, 215, 204, 0.7);
    display: flex;
    align-items: center;
    padding: 0 12px;
    -webkit-app-region: drag;
    position: fixed;
    top: 0; left: 0; right: 0;
    z-index: 1000;
  }

  .titlebar__brand {
    display: flex;
    align-items: center;
  }

  .titlebar__drag { flex: 1; }

  .titlebar__title {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-secondary);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .titlebar__controls {
    display: flex;
    gap: 4px;
    -webkit-app-region: no-drag;
  }

  .titlebar__btn {
    width: 26px;
    height: 22px;
    border: none;
    background: transparent;
    color: var(--text-secondary);
    font-size: 11px;
    font-weight: 600;
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-fast);
  }

  .titlebar__btn:hover {
    background: rgba(0, 0, 0, 0.06);
    color: var(--text-primary);
  }

  .titlebar__btn--close:hover {
    background: var(--clay-red);
    color: #FFFFFF;
  }

  /* ── App Shell (Seamless Grid) ─────────────────────────────────────────── */
  .app-shell {
    display: flex;
    height: 100vh;
    padding-top: 36px;
    background: var(--bg-base);
  }

  /* ── Full-Height Docked Sidebar ────────────────────────────────────────── */
  .sidebar {
    width: 210px;
    min-width: 210px;
    background: #FFFFFF;
    border-right: 1px solid var(--border-subtle);
    display: flex;
    flex-direction: column;
    padding: 16px 12px;
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.02);
  }

  .sidebar__header {
    display: flex;
    flex-direction: column;
    padding: 4px 8px 14px 8px;
    border-bottom: 1px solid var(--border-subtle);
    margin-bottom: 10px;
  }

  .sidebar__brand-name {
    font-size: 13px;
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1.2;
    letter-spacing: -0.01em;
  }

  .sidebar__brand-tag {
    font-size: 9px;
    font-weight: 700;
    color: var(--clay-orange);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-top: 1px;
  }

  .sidebar__nav-wrapper {
    flex: 1;
  }

  .sidebar__nav {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .sidebar__item {
    width: 100%;
    height: 34px;
    display: flex;
    align-items: center;
    padding: 0 10px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-secondary);
    font-size: 13px;
    font-family: var(--font-sans);
    font-weight: 600;
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
    transition: all var(--transition-fast);
  }

  .sidebar__item:hover:not(.sidebar__item--active) {
    background: #FAF9F5;
    color: var(--text-primary);
  }

  .sidebar__item--active {
    background: var(--clay-orange-bg);
    color: var(--clay-orange-text);
    border-color: var(--clay-orange-border);
    font-weight: 700;
    box-shadow: 0 1px 2px rgba(234, 88, 12, 0.08);
  }

  /* ── Main Content Workspace ────────────────────────────────────────────── */
  .main-content {
    flex: 1;
    overflow-y: auto;
    background: var(--bg-base);
    padding: 24px 32px;
  }
</style>
