<script lang="ts">
  export let dailySolves: Record<string, number> = {}

  // Generate the last 365 days
  const today = new Date()
  const days: { dateStr: string; count: number }[] = []
  
  // We want to start on a Sunday so the grid aligns nicely (7 rows)
  const daysToGenerate = 364
  for (let i = daysToGenerate; i >= 0; i--) {
    const d = new Date()
    d.setDate(today.getDate() - i)
    // Format to YYYY-MM-DD in local time
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const dateStr = `${y}-${m}-${day}`
    
    days.push({
      dateStr,
      count: dailySolves[dateStr] ?? 0
    })
  }

  function getLevel(count: number): number {
    if (count === 0) return 0
    if (count <= 2) return 1
    if (count <= 5) return 2
    if (count <= 8) return 3
    return 4
  }

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  
  // Find start of month indices for labels
  const monthLabels: { label: string, col: number }[] = []
  let lastMonth = -1
  days.forEach((day, i) => {
    const d = new Date(day.dateStr)
    const m = d.getMonth()
    if (m !== lastMonth && i > 7) {
      // rough column calculation (i / 7)
      monthLabels.push({ label: months[m], col: Math.floor(i / 7) })
      lastMonth = m
    } else if (lastMonth === -1) {
      lastMonth = m
    }
  })
</script>

<div class="heatmap-card">
  <div class="heatmap-header">
    <h3 class="heatmap-title">Activity Heatmap</h3>
    <span class="heatmap-subtitle">{Object.values(dailySolves).reduce((a, b) => a + b, 0)} solves in the last year</span>
  </div>

  <div class="heatmap-container">
    <!-- Y-axis (Days of week) -->
    <div class="y-axis">
      <span>Mon</span>
      <span>Wed</span>
      <span>Fri</span>
    </div>

    <div class="grid-wrapper">
      <!-- X-axis (Months) -->
      <div class="x-axis">
        {#each monthLabels as { label, col }}
          <span style="grid-column: {col}">{label}</span>
        {/each}
      </div>

      <!-- The Grid (7 rows, ~52 columns) -->
      <div class="heatmap-grid">
        {#each days as day}
          <div 
            class="heatmap-cell level-{getLevel(day.count)}"
            title="{day.dateStr}: {day.count} solves"
          />
        {/each}
      </div>
    </div>
  </div>
  
  <div class="heatmap-legend">
    <span>Less</span>
    <div class="heatmap-cell level-0"></div>
    <div class="heatmap-cell level-1"></div>
    <div class="heatmap-cell level-2"></div>
    <div class="heatmap-cell level-3"></div>
    <div class="heatmap-cell level-4"></div>
    <span>More</span>
  </div>
</div>

<style>
  .heatmap-card {
    background: white;
    border: 1px solid var(--clay-border);
    border-radius: var(--radius-lg);
    padding: 1.5rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
    margin-bottom: 1.5rem;
    overflow-x: auto;
  }

  .heatmap-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .heatmap-title {
    font-size: 1.125rem;
    font-weight: 700;
    color: var(--clay-text-dark);
    margin: 0;
  }

  .heatmap-subtitle {
    font-size: 0.85rem;
    color: var(--clay-text-muted);
  }

  .heatmap-container {
    display: flex;
    gap: 0.5rem;
  }

  .y-axis {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding-top: 1.5rem; /* space for x-axis */
    padding-bottom: 0.5rem;
    font-size: 0.75rem;
    color: var(--clay-text-muted);
    height: 105px;
  }

  .grid-wrapper {
    display: flex;
    flex-direction: column;
    flex: 1;
  }

  .x-axis {
    display: grid;
    grid-template-columns: repeat(52, 1fr);
    font-size: 0.75rem;
    color: var(--clay-text-muted);
    margin-bottom: 0.5rem;
  }

  .heatmap-grid {
    display: grid;
    grid-template-rows: repeat(7, 1fr);
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
    gap: 3px;
    height: 105px;
  }

  .heatmap-cell {
    width: 12px;
    height: 12px;
    border-radius: 2px;
    background-color: var(--clay-bg-alt);
    transition: transform 0.1s ease;
  }
  
  .heatmap-cell:hover {
    transform: scale(1.2);
    box-shadow: 0 0 4px rgba(0,0,0,0.2);
  }

  /* Heatmap Color Scale - GitHub style greens */
  .level-0 { background-color: #EBEDF0; }
  .level-1 { background-color: #9BE9A8; }
  .level-2 { background-color: #40C463; }
  .level-3 { background-color: #30A14E; }
  .level-4 { background-color: #216E39; }

  .heatmap-legend {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 1rem;
    font-size: 0.75rem;
    color: var(--clay-text-muted);
    justify-content: flex-end;
  }
  .heatmap-legend span {
    margin: 0 4px;
  }
</style>
