import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BugcrumbsErrorBoundary } from '@bugcrumbs/react'
import { api, money, type Stats } from '../api'
import { Alert, Button, Skeleton, Tabs } from '../ui'

type Range = '7d' | '30d' | '90d'

function Kpi({ label, value, delta }: { label: string; value: string; delta: number }) {
  return (
    <div className="card">
      <div className="muted small">{label}</div>
      <div className="kpi-value">{value}</div>
      <span className={delta >= 0 ? 'delta-up' : 'delta-down'}>
        {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}% vs previous period
      </span>
    </div>
  )
}

function RevenueChart({ series }: { series: Stats['series'] }) {
  const max = Math.max(...series.map((point) => point.revenue))
  const width = 720
  const height = 220
  const bar = width / series.length
  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height + 20}`} preserveAspectRatio="none" role="img" aria-label={`Daily revenue, ${series.length} days, peak ${money(max)}`}>
      {series.map((point, i) => {
        const h = (point.revenue / max) * (height - 10)
        return (
          <rect key={point.day} x={i * bar + bar * 0.15} y={height - h} width={bar * 0.7} height={h} rx={Math.min(4, bar / 4)}>
            <title>
              {point.day}: {money(point.revenue)}, {point.orders} orders
            </title>
          </rect>
        )
      })}
      <text x="0" y={height + 16}>
        {series[0]?.day}
      </text>
      <text x={width} y={height + 16} textAnchor="end">
        {series.at(-1)?.day}
      </text>
    </svg>
  )
}

/** Has a real bug: regions are missing from the stats payload, so this throws during render (FR-04). */
function RegionBreakdown({ stats }: { stats: Stats }) {
  const regions = (stats as Stats & { regions?: { name: string; share: number }[] }).regions
  return (
    <ul>
      {regions!.map((region) => (
        <li key={region.name}>
          {region.name}: {region.share}%
        </li>
      ))}
    </ul>
  )
}

export function DashboardPage() {
  const [range, setRange] = useState<Range>('7d')
  const [showRegions, setShowRegions] = useState(false)
  const [sortBy, setSortBy] = useState<'units' | 'revenue'>('revenue')
  const stats = useQuery({ queryKey: ['stats', range], queryFn: () => api<Stats>(`/api/stats?range=${range}`), placeholderData: (previous) => previous })

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Store dashboard</h1>
          <p className="muted" style={{ margin: 0 }}>
            {stats.isFetching ? 'Refreshing…' : 'Sales across all channels.'} {range === '90d' && 'The 90-day report is slow.'}
          </p>
        </div>
        <Tabs
          label="Date range"
          value={range}
          onChange={setRange}
          options={[
            { value: '7d', label: 'Last 7 days' },
            { value: '30d', label: '30 days' },
            { value: '90d', label: '90 days' },
          ]}
        />
      </div>

      {stats.isError ? (
        <Alert title="Couldn’t load stats">{stats.error.message}</Alert>
      ) : !stats.data ? (
        <div className="kpis">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} height={110} />
          ))}
        </div>
      ) : (
        <div style={{ opacity: stats.isPlaceholderData ? 0.6 : 1, transition: 'opacity .2s' }}>
          <div className="kpis">
            <Kpi label="Revenue" value={money(stats.data.revenue)} delta={stats.data.deltas.revenue} />
            <Kpi label="Orders" value={stats.data.orders.toLocaleString('en-GB')} delta={stats.data.deltas.orders} />
            <Kpi label="Average order" value={money(stats.data.averageOrder)} delta={stats.data.deltas.averageOrder} />
            <Kpi label="Conversion" value={`${stats.data.conversion.toFixed(1)}%`} delta={stats.data.deltas.conversion} />
          </div>
          <div className="grid-2" style={{ gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)' }}>
            <section className="card" aria-label="Revenue chart">
              <h2>Revenue</h2>
              <RevenueChart series={stats.data.series} />
            </section>
            <section className="card" aria-label="Revenue by region">
              <div className="between">
                <h2>Revenue by region</h2>
                {!showRegions && (
                  <Button size="sm" onClick={() => setShowRegions(true)}>
                    Show breakdown
                  </Button>
                )}
              </div>
              {showRegions ? (
                <BugcrumbsErrorBoundary
                  fallback={
                    <Alert
                      title="This widget crashed"
                      action={
                        <Button size="sm" onClick={() => setShowRegions(false)}>
                          Reset
                        </Button>
                      }
                    >
                      The error and component stack were captured by Bugcrumbs.
                    </Alert>
                  }
                >
                  <RegionBreakdown stats={stats.data} />
                </BugcrumbsErrorBoundary>
              ) : (
                <p className="muted">UK, EU and US split for the selected period.</p>
              )}
            </section>
          </div>
          <section className="card" aria-label="Top products" style={{ marginTop: 24, padding: 0, overflow: 'hidden' }}>
            <h2 style={{ padding: '20px 20px 4px' }}>Top products</h2>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col" className="num" aria-sort={sortBy === 'units' ? 'descending' : undefined}>
                    <button type="button" className="th-button" onClick={() => setSortBy('units')}>
                      Units {sortBy === 'units' && '↓'}
                    </button>
                  </th>
                  <th scope="col" className="num" aria-sort={sortBy === 'revenue' ? 'descending' : undefined}>
                    <button type="button" className="th-button" onClick={() => setSortBy('revenue')}>
                      Revenue {sortBy === 'revenue' && '↓'}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...stats.data.topProducts]
                  .sort((a, b) => b[sortBy] - a[sortBy])
                  .map((product) => (
                    <tr key={product.id}>
                      <td>{product.name}</td>
                      <td className="num">{product.units}</td>
                      <td className="num">{money(product.revenue)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </>
  )
}
