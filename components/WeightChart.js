'use client';

import React, { useEffect, useRef, useState } from 'react';
import { TrendingUp } from 'lucide-react';

export default function WeightChart({ weightHistory }) {
  const svgRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);

  // Take last 30 entries (already sorted newest first — reverse for chart)
  const chartData = [...weightHistory].slice(0, 30).reverse();

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || chartData.length < 2) return;
    const path = svg.querySelector('.chart-line');
    if (path) {
      const len = path.getTotalLength();
      path.style.strokeDasharray = len;
      path.style.strokeDashoffset = len;
      path.getBoundingClientRect(); // trigger reflow
      path.style.transition = 'stroke-dashoffset 1.4s cubic-bezier(0.4, 0, 0.2, 1)';
      path.style.strokeDashoffset = '0';
    }
  }, [chartData.length]);

  if (chartData.length < 2) {
    return (
      <div className="empty-state" style={{ padding: '32px' }}>
        <span className="empty-state-icon"><TrendingUp size={40} color="#94a3b8" /></span>
        <p>Log at least 2 days to see your trend chart.</p>
      </div>
    );
  }

  const W = 600, H = 200;
  const PAD = { top: 20, right: 20, bottom: 36, left: 44 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const weights = chartData.map(d => d.weight);
  const minW = Math.min(...weights) - 1;
  const maxW = Math.max(...weights) + 1;

  const xScale = (i) => PAD.left + (i / (chartData.length - 1)) * innerW;
  const yScale = (w) => PAD.top + innerH - ((w - minW) / (maxW - minW)) * innerH;

  const points = chartData.map((d, i) => ({ x: xScale(i), y: yScale(d.weight), ...d }));
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${PAD.top + innerH} L ${points[0].x} ${PAD.top + innerH} Z`;

  // Y-axis labels
  const yTicks = 4;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) => minW + ((maxW - minW) / yTicks) * i);

  // X-axis: show first, middle, last date labels — deduplicated
  const xLabelIndices = [...new Set([0, Math.floor(chartData.length / 2), chartData.length - 1])];

  const formatDate = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto', overflow: 'visible' }}
        onMouseLeave={() => setTooltip(null)}
      >
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(150,60%,35%)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="hsl(150,60%,35%)" stopOpacity="0" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Grid lines */}
        {yTickValues.map((val, i) => (
          <g key={`ytick-${i}`}>
            <line
              x1={PAD.left} y1={yScale(val)}
              x2={PAD.left + innerW} y2={yScale(val)}
              stroke="var(--border-color)" strokeWidth="1" strokeDasharray="4 4"
            />
            <text
              x={PAD.left - 6} y={yScale(val) + 4}
              textAnchor="end" fontSize="11" fill="var(--text-muted)"
            >
              {val.toFixed(1)}
            </text>
          </g>
        ))}

        {/* Area fill */}
        <path d={areaPath} fill="url(#areaGrad)" />

        {/* Line */}
        <path
          d={linePath}
          className="chart-line"
          fill="none"
          stroke="hsl(150,60%,45%)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#glow)"
        />

        {/* Data points + hover zones */}
        {points.map((p, i) => (
          <g key={`pt-${i}`}>
            <circle cx={p.x} cy={p.y} r="4" fill="hsl(150,60%,45%)" stroke="var(--card-bg)" strokeWidth="2" />
            {/* invisible hover zone */}
            <rect
              x={p.x - 20} y={PAD.top}
              width="40" height={innerH}
              fill="transparent"
              onMouseEnter={() => setTooltip({ x: p.x, y: p.y, weight: p.weight, date: p.date })}
            />
          </g>
        ))}

        {/* X-axis date labels */}
        {xLabelIndices.map((idx) => {
          if (idx >= chartData.length) return null;
          return (
            <text
              key={idx}
              x={points[idx].x}
              y={PAD.top + innerH + 24}
              textAnchor="middle"
              fontSize="11"
              fill="var(--text-muted)"
            >
              {formatDate(chartData[idx].date)}
            </text>
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: 'absolute',
            left: `${(tooltip.x / 600) * 100}%`,
            top: `${(tooltip.y / 200) * 100}%`,
            transform: 'translate(-50%, -120%)',
            background: 'var(--card-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '6px 12px',
            fontSize: '0.8rem',
            fontWeight: '600',
            color: 'var(--text-main)',
            backdropFilter: 'blur(12px)',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          {tooltip.weight.toFixed(1)} kg · {new Date(tooltip.date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
        </div>
      )}
    </div>
  );
}
