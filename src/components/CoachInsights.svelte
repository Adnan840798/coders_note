<script lang="ts">
  import type { AnalysisResult } from '../../../shared/types'

  export let analysis: AnalysisResult
  export let totalSolved: number
  export let totalSubs: number

  $: verdictBreakdown = analysis.verdictBreakdown
  $: attemptEfficiency = totalSolved > 0 ? (totalSubs / totalSolved).toFixed(2) : '0'

  $: waRate = totalSubs > 0 ? (verdictBreakdown['WRONG_ANSWER'] / totalSubs) * 100 : 0
  $: tleRate = totalSubs > 0 ? (verdictBreakdown['TIME_LIMIT_EXCEEDED'] / totalSubs) * 100 : 0
  $: rteRate = totalSubs > 0 ? (verdictBreakdown['RUNTIME_ERROR'] / totalSubs) * 100 : 0
  $: ceRate = totalSubs > 0 ? (verdictBreakdown['COMPILATION_ERROR'] / totalSubs) * 100 : 0

  function getInsightLevel(rate: number, threshold: number): 'high' | 'medium' | 'low' {
    if (rate >= threshold) return 'high'
    if (rate >= threshold / 2) return 'medium'
    return 'low'
  }

  $: waLevel = getInsightLevel(waRate, 40)
  $: tleLevel = getInsightLevel(tleRate, 15)
  $: rteLevel = getInsightLevel(rteRate, 10)
  $: ceLevel = getInsightLevel(ceRate, 10)
</script>

<div class="coach-card">
  <div class="coach-header">
    <h3 class="coach-title">Performance Diagnostics</h3>
    <div class="efficiency-stat">
      <span class="eff-label">Efficiency</span>
      <span class="eff-value" class:text-success={Number(attemptEfficiency) < 2.0} class:text-danger={Number(attemptEfficiency) >= 2.5}>
        {attemptEfficiency} <small>Subs/AC</small>
      </span>
    </div>
  </div>

  <div class="insights-list">
    <!-- Attempt Efficiency Feedback -->
    {#if Number(attemptEfficiency) > 2.5}
      <div class="insight-item">
        <h4 class="insight-label text-warning">Suboptimal Attempt Efficiency</h4>
        <p class="insight-desc">Averaging {attemptEfficiency} submissions per solve. Consider rigorous local testing and edge-case verification prior to submission to minimize penalties.</p>
      </div>
    {:else if Number(attemptEfficiency) < 1.5 && totalSolved > 10}
      <div class="insight-item">
        <h4 class="insight-label text-success">High Attempt Efficiency</h4>
        <p class="insight-desc">Averaging {attemptEfficiency} submissions per solve. Your submission accuracy and implementation precision are well within professional standards.</p>
      </div>
    {/if}

    <!-- WA Feedback -->
    {#if waLevel === 'high'}
      <div class="insight-item">
        <h4 class="insight-label text-warning">Logical Inconsistencies ({Math.round(waRate)}% WA)</h4>
        <p class="insight-desc">Elevated Wrong Answer rate detected. Recommended focus areas include extensive edge-case generation and manual variable tracing to solidify logic.</p>
      </div>
    {:else if waLevel === 'medium'}
      <div class="insight-item">
        <h4 class="insight-label text-info">Logical Precision ({Math.round(waRate)}% WA)</h4>
        <p class="insight-desc">Minor logic errors observed. Ensure verification of boundary conditions (e.g. constraints limits and minimal inputs).</p>
      </div>
    {/if}

    <!-- TLE Feedback -->
    {#if tleLevel === 'high'}
      <div class="insight-item">
        <h4 class="insight-label text-danger">Time Complexity ({Math.round(tleRate)}% TLE)</h4>
        <p class="insight-desc">Substantial Time Limit Exceeded rate. Focus on analyzing asymptotic complexity (Big O) and minimizing unoptimized I/O operations.</p>
      </div>
    {/if}

    <!-- RTE Feedback -->
    {#if rteLevel === 'high'}
      <div class="insight-item">
        <h4 class="insight-label text-danger">Implementation Stability ({Math.round(rteRate)}% RTE)</h4>
        <p class="insight-desc">Elevated Runtime Error rate. Validate array bounds handling, prevent zero divisions, and verify memory allocations.</p>
      </div>
    {/if}

    <!-- Fallback if very few errors -->
    {#if Number(attemptEfficiency) >= 1.5 && Number(attemptEfficiency) <= 2.5 && waLevel === 'low' && tleLevel === 'low' && rteLevel === 'low'}
      <div class="insight-item">
        <h4 class="insight-label text-success">Stable Diagnostics</h4>
        <p class="insight-desc">Error margins are maintained within acceptable bounds. Maintain consistent practice routines.</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .coach-card {
    background: white;
    border: 1px solid var(--clay-border);
    border-radius: var(--radius-lg);
    padding: 1.5rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
    margin-bottom: 1.5rem;
  }

  .coach-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--clay-border);
  }

  .coach-title {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--clay-text-dark);
    margin: 0;
  }

  .efficiency-stat {
    display: flex;
    align-items: baseline;
    gap: 0.5rem;
  }

  .eff-label {
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--clay-text-muted);
    font-weight: 600;
  }

  .eff-value {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--clay-text-dark);
  }

  .eff-value small {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--clay-text-muted);
    margin-left: 0.15rem;
  }

  .insights-list {
    display: flex;
    flex-direction: column;
  }

  .insight-item {
    padding: 1.25rem 0;
    border-bottom: 1px solid var(--bg-inset);
  }

  .insight-item:last-child {
    border-bottom: none;
    padding-bottom: 0.25rem;
  }

  .insight-label {
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin: 0 0 0.5rem 0;
  }

  .insight-desc {
    margin: 0;
    font-size: 0.95rem;
    color: var(--clay-text);
    line-height: 1.6;
  }

  .text-warning { color: var(--clay-yellow-hover); }
  .text-success { color: var(--clay-green-hover); }
  .text-danger { color: var(--clay-red-hover); }
  .text-info { color: var(--clay-text-dark); }
</style>
