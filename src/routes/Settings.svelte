<script lang="ts">
  import { onMount } from 'svelte'
  import { settings } from '../stores/settings.store'
  import type { AppSettings } from '../../shared/types'

  let localSettings: Partial<AppSettings> = {
    theme: 'light',
  }
  let saved = false

  onMount(async () => {
    await settings.load()
    localSettings = { ...$settings, theme: 'light' }
  })

  async function save() {
    localSettings.theme = 'light'
    await settings.update(localSettings)
    saved = true
    setTimeout(() => saved = false, 2500)
  }
</script>

<div class="settings-page anim-fade-in">
  <header class="page-header">
    <h1 class="page-title">Application Settings</h1>
    <p class="subtitle">Configure desktop notifications, default handle sync, and background cache timers</p>
  </header>

  <div class="settings-stack">

    <!-- Profile Defaults -->
    <section class="config-card">
      <div class="card-header">
        <h2 class="card-title">Default Account</h2>
        <p class="card-desc">Auto-load profile on startup</p>
      </div>

      <div class="config-row">
        <div class="config-text">
          <label class="config-name" for="input-default-handle">Default Handle</label>
          <span class="config-help">Codeforces username to sync upon launching (format: codeforces:handle)</span>
        </div>

        <input
          class="input-clean"
          type="text"
          placeholder="codeforces:tourist"
          bind:value={localSettings.defaultHandle}
          id="input-default-handle"
        />
      </div>
    </section>

    <!-- Notifications -->
    <section class="config-card">
      <div class="card-header">
        <h2 class="card-title">Contest Notifications</h2>
        <p class="card-desc">System tray alerts and reminders</p>
      </div>

      <div class="config-row">
        <div class="config-text">
          <span class="config-name">Desktop Notifications</span>
          <span class="config-help">Show OS alert banner when upcoming contests near start time</span>
        </div>

        <label class="toggle-pill-label" for="toggle-notifications">
          <input type="checkbox" bind:checked={localSettings.notificationsEnabled} id="toggle-notifications" />
          <span class="toggle-track" />
        </label>
      </div>

      <div class="config-row">
        <div class="config-text">
          <label class="config-name" for="input-reminder-lead">Reminder Lead Time</label>
          <span class="config-help">How many minutes prior to contest start to trigger desktop notification</span>
        </div>

        <div class="number-group">
          <input
            class="input-clean input-clean--num"
            type="number"
            min="5"
            max="120"
            step="5"
            bind:value={localSettings.reminderLeadMinutes}
            id="input-reminder-lead"
          />
          <span class="unit-text">minutes</span>
        </div>
      </div>
    </section>

    <!-- Data & Cache -->
    <section class="config-card">
      <div class="card-header">
        <h2 class="card-title">Background Data Cache</h2>
        <p class="card-desc">Polling intervals for schedule synchronization</p>
      </div>

      <div class="config-row">
        <div class="config-text">
          <label class="config-name" for="input-cache-interval">Contest Cache TTL</label>
          <span class="config-help">Frequency to re-sync contest lists from remote APIs</span>
        </div>

        <div class="number-group">
          <input
            class="input-clean input-clean--num"
            type="number"
            min="5"
            max="120"
            step="5"
            bind:value={localSettings.cacheRefreshIntervalMinutes}
            id="input-cache-interval"
          />
          <span class="unit-text">minutes</span>
        </div>
      </div>
    </section>

  </div>

  <!-- Save Button -->
  <div class="settings-footer">
    <button class="btn btn--primary" on:click={save} id="btn-save-settings">
      {#if saved}
        <span>✓</span> Saved Successfully
      {:else}
        <span>💾</span> Save Changes
      {/if}
    </button>
  </div>
</div>

<style>
  .settings-page {
    max-width: 820px;
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

  .settings-stack {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .config-card {
    background: #FFFFFF;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-clay-card);
    padding: var(--space-5);
    border: 1px solid var(--border-subtle);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .card-header {
    padding-bottom: var(--space-2);
    border-bottom: 1px solid var(--border-subtle);
  }

  .card-title {
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--text-primary);
  }

  .card-desc {
    font-size: var(--text-xs);
    color: var(--text-muted);
    font-weight: 500;
    margin-top: 1px;
  }

  .config-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-4);
    flex-wrap: wrap;
  }

  .config-text {
    flex: 1;
    min-width: 220px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .config-name {
    font-size: var(--text-sm);
    font-weight: 600;
    color: var(--text-primary);
  }

  .config-help {
    font-size: var(--text-xs);
    color: var(--text-secondary);
  }

  .input-clean {
    height: 38px;
    padding: 0 var(--space-3);
    background: var(--bg-inset);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    color: var(--text-primary);
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    font-weight: 500;
    min-width: 220px;
    outline: none;
  }

  .input-clean:focus {
    background: #FFFFFF;
    border-color: var(--clay-orange);
    box-shadow: 0 0 0 3px rgba(234, 88, 12, 0.12);
  }

  .input-clean--num {
    width: 80px;
    min-width: 80px;
    text-align: center;
  }

  .number-group {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .unit-text {
    font-size: var(--text-xs);
    font-weight: 600;
    color: var(--text-muted);
  }

  /* Toggle Switch */
  .toggle-pill-label {
    display: inline-flex;
    align-items: center;
    cursor: pointer;
  }

  .toggle-pill-label input {
    opacity: 0;
    width: 0;
    height: 0;
    position: absolute;
  }

  .toggle-track {
    width: 40px;
    height: 22px;
    border-radius: var(--radius-full);
    background: var(--bg-inset);
    border: 1px solid var(--border-default);
    position: relative;
    transition: all var(--transition-fast);
  }

  .toggle-track::after {
    content: '';
    position: absolute;
    width: 16px;
    height: 16px;
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
    transform: translateX(18px);
  }

  .settings-footer {
    margin-top: var(--space-5);
    display: flex;
    justify-content: flex-end;
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px var(--space-6);
    border: 1px solid transparent;
    border-radius: var(--radius-sm);
    font-family: var(--font-sans);
    font-size: var(--text-sm);
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .btn--primary {
    background: linear-gradient(135deg, #F97316 0%, #EA580C 100%);
    color: #FFFFFF;
    box-shadow: var(--shadow-clay-btn-orange);
  }

  .btn--primary:hover {
    filter: brightness(1.06);
  }
</style>
