'use client'

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

interface ChartDataPoint {
  date: string
  impressions: number
  clicks: number
}

export default function NexusMetricsChart({ data }: { data: ChartDataPoint[] }) {
  return (
    <div style={{ width: '100%', height: 280 }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="nxImpGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6C63FF" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#6C63FF" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="nxClickGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00D4AA" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#00D4AA" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="date" tick={{ fill: 'rgba(246,252,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: 'rgba(246,252,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{ background: '#13132A', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 13, color: '#F6FCFF' }}
            labelStyle={{ color: 'rgba(246,252,255,0.5)' }}
          />
          <Area type="monotone" dataKey="impressions" stroke="#6C63FF" fill="url(#nxImpGrad)" strokeWidth={2} dot={false} />
          <Area type="monotone" dataKey="clicks" stroke="#00D4AA" fill="url(#nxClickGrad)" strokeWidth={2} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
