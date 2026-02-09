import { useState, useMemo, useEffect } from 'react'
import * as d3 from 'd3'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep']

const TYPE_ORDER = [
  'Tops',
  'Pants',
  'Sweaters',
  'Dresses',
  'Collared Shirts',
  'Accessories',
  'Skirts',
  'Outerwear',
  'Shorts',
  'Shoes',
]

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

const UNIT = 10

// Annotations: each triggers a type highlight, a month highlight, or both
const ANNOTATIONS = [
  {
    text: 'Sweaters peak in the cold months',
    type: 'Sweaters',
    color: COLORS.Sweaters,
  },
  {
    text: 'Tops are the most popular year-round',
    type: 'Tops',
    color: COLORS.Tops,
  },
  {
    text: 'Things slow down during breaks',
    monthIndices: [2, 4, 5, 6], // Mar, May, Jun, Jul
    color: '#333',
  },
  {
    text: 'September back-to-school rush',
    monthIndices: [8], // Sep
    color: '#333',
  },
]

function App() {
  const [raw, setRaw] = useState(null)
  const [hoveredMonths, setHoveredMonths] = useState(null) // null or Set of timestamps
  const [hoveredType, setHoveredType] = useState(null)

  useEffect(() => {
    d3.csv('./seasonal.csv', (d) => ({
      month: d3.timeParse('%Y-%m-%d')(d.month),
      type: d.type,
      n: +d.n,
    })).then(setRaw)
  }, [])

  const cellSize = 16
  const cellGap = 2
  const cols = 3
  const monthGap = 14

  const { months, panels, maxRows, typeTotals } = useMemo(() => {
    if (!raw) return { months: [], panels: [], maxRows: 0, typeTotals: [] }

    const months = [...new Set(raw.map((d) => d.month.getTime()))]
      .sort()
      .map((t) => new Date(t))

    const panels = months.map((m) => {
      const cells = []
      for (const type of TYPE_ORDER) {
        const match = raw.find((d) => d.month.getTime() === m.getTime() && d.type === type)
        const count = match ? Math.round(match.n / UNIT) : 0
        for (let i = 0; i < count; i++) {
          cells.push({ type })
        }
      }
      const rows = Math.ceil(cells.length / cols)
      const total = cells.length * UNIT
      return { month: m, cells, rows, total }
    })

    const maxRows = Math.max(...panels.map((p) => p.rows))

    const typeTotals = TYPE_ORDER.map((type) => ({
      type,
      total: d3.sum(raw.filter((d) => d.type === type), (d) => d.n),
    }))

    return { months, panels, maxRows, typeTotals }
  }, [raw])

  const panelWidth = cols * (cellSize + cellGap) - cellGap
  const gridHeight = maxRows * (cellSize + cellGap) - cellGap
  const labelSpace = 40
  const topPad = 20
  const marginLeft = 30
  const waffleWidth = Math.max(1, panels.length) * (panelWidth + monthGap) - monthGap
  const barGap = 30
  const barWidth = 80
  const barLabelWidth = 140
  const svgWidth = marginLeft + waffleWidth + barGap + barWidth + barLabelWidth + 10
  const svgHeight = gridHeight + labelSpace + topPad + 10

  const sortedTotals = [...typeTotals].sort((a, b) => b.total - a.total)
  const barItemHeight = sortedTotals.length > 0 ? gridHeight / sortedTotals.length : 0
  const barScale = useMemo(
    () => d3.scaleLinear().domain([0, d3.max(typeTotals, (d) => d.total) || 1]).range([0, barWidth]),
    [typeTotals, barWidth]
  )
  const barX = marginLeft + waffleWidth + barGap

  if (!raw || panels.length === 0) return <div className="app">Loading...</div>

  const isMonthHovered = (m) => hoveredMonths !== null && hoveredMonths.has(m.getTime())
  const anyMonthHovered = hoveredMonths !== null

  // For tooltip, show first hovered month (single-month hover only)
  const hoveredPanel = (anyMonthHovered && hoveredMonths.size === 1)
    ? panels.find((p) => hoveredMonths.has(p.month.getTime()))
    : null

  const handleAnnotationEnter = (ann) => {
    if (ann.type) {
      setHoveredType(ann.type)
      setHoveredMonths(null)
    } else if (ann.monthIndices) {
      setHoveredMonths(new Set(ann.monthIndices.map((i) => months[i].getTime())))
      setHoveredType(null)
    }
  }

  const handleAnnotationLeave = (ann) => {
    if (ann.type) setHoveredType(null)
    if (ann.monthIndices) setHoveredMonths(null)
  }

  return (
    <div className="app">
      <div className="subtitle">1 square = {UNIT} items</div>
      <svg width={svgWidth} height={svgHeight}>
        <g transform={`translate(${marginLeft},${topPad})`}>
          {panels.map((panel, pi) => {
            const px = pi * (panelWidth + monthGap)
            const mi = months.findIndex((m) => m.getTime() === panel.month.getTime())
            const isMonthActive = !anyMonthHovered || isMonthHovered(panel.month)

            return (
              <g
                key={panel.month.toISOString()}
                transform={`translate(${px},0)`}
                onMouseEnter={() => { setHoveredMonths(new Set([panel.month.getTime()])); setHoveredType(null) }}
                onMouseLeave={() => setHoveredMonths(null)}
                style={{ cursor: 'pointer' }}
              >
                <rect x={-2} y={0} width={panelWidth + 4} height={gridHeight + labelSpace} fill="transparent" />

                <text
                  x={panelWidth / 2}
                  y={gridHeight + 18}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight={isMonthActive && anyMonthHovered ? 'bold' : 'normal'}
                  opacity={isMonthActive ? 1 : 0.3}
                >
                  {MONTHS[mi]}
                </text>
                {isMonthActive && anyMonthHovered && (
                  <text
                    x={panelWidth / 2}
                    y={gridHeight + 33}
                    textAnchor="middle"
                    fontSize={10}
                    fill="#888"
                  >
                    {panel.total} items
                  </text>
                )}

                {panel.cells.map((cell, ci) => {
                  const col = ci % cols
                  const row = Math.floor(ci / cols)
                  const x = col * (cellSize + cellGap)
                  const y = gridHeight - (row + 1) * (cellSize + cellGap) + cellGap

                  let opacity = 0.85
                  if (hoveredType !== null) {
                    opacity = cell.type === hoveredType ? 0.95 : 0.1
                  } else if (anyMonthHovered) {
                    opacity = isMonthActive ? 0.9 : 0.15
                  }

                  return (
                    <rect
                      key={ci}
                      x={x}
                      y={y}
                      width={cellSize}
                      height={cellSize}
                      fill={COLORS[cell.type]}
                      opacity={opacity}
                      rx={2}
                    />
                  )
                })}
              </g>
            )
          })}
        </g>

        {/* Totals bar chart / legend on the right */}
        <g transform={`translate(${barX},${topPad})`}>
          <text x={barWidth / 2} y={-8} textAnchor="middle" fontSize={12} fontWeight="bold" fill="#666">
            Total
          </text>
          {sortedTotals.map((d, i) => {
            const isActive = hoveredType === null || hoveredType === d.type
            const y = i * barItemHeight + barItemHeight * 0.15
            const h = barItemHeight * 0.7
            return (
              <g
                key={d.type}
                onMouseEnter={() => { setHoveredType(d.type); setHoveredMonths(null) }}
                onMouseLeave={() => setHoveredType(null)}
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
                <text
                  x={barWidth + 36}
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

      {/* Annotations below the chart */}
      <div className="annotations">
        {ANNOTATIONS.map((ann, i) => {
          const isActive =
            (ann.type && hoveredType === ann.type) ||
            (ann.monthIndices && anyMonthHovered && ann.monthIndices.some((i) => hoveredMonths.has(months[i].getTime())))
          return (
            <span
              key={i}
              className={`annotation ${isActive ? 'active' : ''}`}
              style={{ borderColor: ann.color, color: ann.color }}
              onMouseEnter={() => handleAnnotationEnter(ann)}
              onMouseLeave={() => handleAnnotationLeave(ann)}
            >
              {ann.text}
            </span>
          )
        })}
      </div>

      {/* Tooltip for hovered month */}
      {hoveredPanel && (
        <div className="tooltip">
          <strong>{MONTHS[months.findIndex((m) => m.getTime() === hoveredPanel.month.getTime())]} 2025</strong>
          {TYPE_ORDER.map((type) => {
            const match = raw.find(
              (d) => d.month.getTime() === hoveredPanel.month.getTime() && d.type === type
            )
            const n = match ? match.n : 0
            if (n === 0) return null
            return (
              <div key={type} className="tooltip-row">
                <span className="swatch" style={{ background: COLORS[type] }} />
                {type}: {n}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default App
