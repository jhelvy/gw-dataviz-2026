import { useState, useMemo, useEffect } from 'react'
import * as d3 from 'd3'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct']

const COLORS = {
  Tops: '#4e79a7',
  Pants: '#f28e2b',
  Sweaters: '#e15759',
  Dresses: '#76b7b2',
  'Collared Shirts': '#59a14f',
  Accessories: '#edc948',
  Skirts: '#b07aa1',
  Outerwear: '#ff9da7',
  Shorts: '#9c755f',
  Shoes: '#bab0ac',
}

function App() {
  const [raw, setRaw] = useState(null)
  const [highlighted, setHighlighted] = useState(null)

  useEffect(() => {
    d3.csv('./seasonal.csv', (d) => ({
      month: d3.timeParse('%Y-%m-%d')(d.month),
      type: d.type,
      n: +d.n,
    })).then(setRaw)
  }, [])

  const streamWidth = 520
  const barWidth = 80
  const gap = 30
  const width = streamWidth + gap + barWidth + 140
  const height = 440
  const margin = { top: 30, right: 140, bottom: 50, left: 40 }
  const innerStreamWidth = streamWidth - margin.left
  const innerHeight = height - margin.top - margin.bottom

  const { months, types, stacked, totals, xScale, yScale, barScale } = useMemo(() => {
    if (!raw) return {}

    const months = [...new Set(raw.map((d) => d.month.getTime()))].sort().map((t) => new Date(t))

    // Order types by total descending
    const typeTotals = d3.rollup(raw, (v) => d3.sum(v, (d) => d.n), (d) => d.type)
    const types = [...typeTotals.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t)
    const totals = types.map((t) => ({ type: t, total: typeTotals.get(t) }))

    // Pivot to wide format
    const wide = months.map((m) => {
      const row = { month: m }
      for (const t of types) {
        const match = raw.find((d) => d.month.getTime() === m.getTime() && d.type === t)
        row[t] = match ? match.n : 0
      }
      return row
    })

    const stack = d3.stack()
      .keys(types)
      .order(d3.stackOrderInsideOut)
      .offset(d3.stackOffsetSilhouette)
    const stacked = stack(wide)

    const xScale = d3.scalePoint().domain(months).range([0, innerStreamWidth])
    const yMin = d3.min(stacked, (layer) => d3.min(layer, (d) => d[0]))
    const yMax = d3.max(stacked, (layer) => d3.max(layer, (d) => d[1]))
    const yScale = d3.scaleLinear().domain([yMin, yMax]).range([innerHeight, 0])

    // Bar scale for totals sidebar
    const barScale = d3.scaleLinear()
      .domain([0, d3.max(totals, (d) => d.total)])
      .range([0, barWidth])

    return { months, types, stacked, totals, xScale, yScale, barScale }
  }, [raw, innerStreamWidth, innerHeight])

  if (!raw || !stacked) return <div className="app">Loading...</div>

  const area = d3
    .area()
    .x((d) => xScale(d.data.month))
    .y0((d) => yScale(d[0]))
    .y1((d) => yScale(d[1]))
    .curve(d3.curveCatmullRom)

  const barX = margin.left + innerStreamWidth + gap
  const barItemHeight = innerHeight / types.length

  return (
    <div className="app">
      <svg width={width} height={height}>
        <g transform={`translate(${margin.left},${margin.top})`}>
          {/* Stream chart */}
          {stacked.map((layer) => {
            const isActive = highlighted === null || highlighted === layer.key
            return (
              <path
                key={layer.key}
                d={area(layer)}
                fill={COLORS[layer.key]}
                opacity={isActive ? 0.85 : 0.12}
                stroke={highlighted === layer.key ? '#fff' : 'none'}
                strokeWidth={0.5}
                onMouseEnter={() => setHighlighted(layer.key)}
                onMouseLeave={() => setHighlighted(null)}
                style={{ cursor: 'pointer' }}
              />
            )
          })}

          {/* X axis labels */}
          {months.map((m, i) => (
            <g key={m.toISOString()}>
              <line x1={xScale(m)} x2={xScale(m)} y1={0} y2={innerHeight} stroke="#ddd" strokeDasharray="2,3" />
              <text x={xScale(m)} y={innerHeight + 20} textAnchor="middle" fontSize={12} fill="#666">
                {MONTHS[i]}
              </text>
            </g>
          ))}
          <text x={innerStreamWidth / 2} y={innerHeight + 42} textAnchor="middle" fontSize={13} fill="#999">
            2025
          </text>
        </g>

        {/* Totals bar chart */}
        <g transform={`translate(${barX},${margin.top})`}>
          <text x={barWidth / 2} y={-12} textAnchor="middle" fontSize={12} fontWeight="bold" fill="#666">
            Total
          </text>
          {totals.map((d, i) => {
            const isActive = highlighted === null || highlighted === d.type
            const y = i * barItemHeight + barItemHeight * 0.15
            const h = barItemHeight * 0.7
            return (
              <g
                key={d.type}
                onMouseEnter={() => setHighlighted(d.type)}
                onMouseLeave={() => setHighlighted(null)}
                style={{ cursor: 'pointer' }}
              >
                <rect
                  x={0}
                  y={y}
                  width={barScale(d.total)}
                  height={h}
                  fill={COLORS[d.type]}
                  opacity={isActive ? 0.85 : 0.15}
                  rx={2}
                />
                {isActive && (
                  <text x={barScale(d.total) + 4} y={y + h / 2} dominantBaseline="middle" fontSize={11} fill="#666">
                    {d.total}
                  </text>
                )}
                {/* Label to the right */}
                <text
                  x={barWidth + 8}
                  y={y + h / 2}
                  dominantBaseline="middle"
                  fontSize={12}
                  opacity={isActive ? 1 : 0.35}
                >
                  {d.type}
                </text>
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}

export default App
