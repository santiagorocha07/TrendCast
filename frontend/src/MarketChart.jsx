import React, { useState } from "react";
import {
  Area,
  ComposedChart,
  Line,
  CartesianGrid,
  ReferenceLine,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { sessionLens } from "./marketLens.js";
const price = (n) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
const delta = (n) =>
  n == null ? "N/A" : `${n >= 0 ? "+" : ""}${(n * 100).toFixed(2)}%`;
const labelDate = (d) =>
  new Date(`${d}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export default function MarketChart({ history }) {
  const [index, setIndex] = useState(history.length - 1);
  const [sma20, setSma20] = useState(true);
  const [sma50, setSma50] = useState(true);
  const lens = sessionLens(history, index);
  if (!lens) return <p>No price history available.</p>;
  return (
    <>
      <div className="price-strip">
        <strong>{price(lens.point.close)}</strong>
        <span
          className={
            lens.dailyReturn == null
              ? "muted"
              : lens.dailyReturn >= 0
                ? "positive"
                : "negative"
          }
        >
          {delta(lens.dailyReturn)}
          <small>SESSION CHANGE</small>
        </span>
        <span className="selected-date">
          {labelDate(lens.point.date)}
          <small>INSPECTED CLOSE</small>
        </span>
      </div>
      <div className="chart-legend">
        <span>
          <i className="close-key" />
          Adjusted close
        </span>
        <button aria-pressed={sma20} onClick={() => setSma20(!sma20)}>
          <i className="sma20-key" />
          SMA 20
        </button>
        <button aria-pressed={sma50} onClick={() => setSma50(!sma50)}>
          <i className="sma50-key" />
          SMA 50
        </button>
      </div>
      <div
        className="market-chart"
        role="img"
        aria-label={`Adjusted closing price chart, ${history.length} sessions. Use the Time Lens slider below to inspect each session.`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={history}
            margin={{ top: 20, right: 8, left: 0, bottom: 0 }}
            accessibilityLayer={false}
            onMouseMove={(state) => {
              if (state.activeTooltipIndex != null) {
                const selected = Number(state.activeTooltipIndex);
                if (
                  Number.isInteger(selected) &&
                  selected >= 0 &&
                  selected < history.length
                )
                  setIndex(selected);
              }
            }}
          >
            <defs>
              <linearGradient id="price-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff8550" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#ff8550" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              vertical={false}
              stroke="#29313d"
              strokeDasharray="2 5"
            />
            <Tooltip content={() => null} cursor={false} />
            <XAxis
              dataKey="date"
              minTickGap={70}
              tickLine={false}
              axisLine={false}
              tick={{
                fill: "#a4adbb",
                fontSize: 11,
                fontFamily: "IBM Plex Mono",
              }}
              tickFormatter={(d) =>
                new Date(`${d}T12:00:00`).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              }
            />
            <YAxis
              orientation="right"
              domain={["auto", "auto"]}
              width={56}
              tickLine={false}
              axisLine={false}
              tick={{
                fill: "#a4adbb",
                fontSize: 11,
                fontFamily: "IBM Plex Mono",
              }}
              tickFormatter={(n) => n.toFixed(0)}
            />
            <Area
              type="linear"
              dataKey="close"
              stroke="#ff8550"
              strokeWidth={2}
              fill="url(#price-fill)"
              isAnimationActive={false}
            />
            {sma20 && (
              <Line
                type="linear"
                dataKey="sma20"
                stroke="#91bbc9"
                strokeWidth={1.3}
                dot={false}
                isAnimationActive={false}
              />
            )}
            {sma50 && (
              <Line
                type="linear"
                dataKey="sma50"
                stroke="#c0a7d2"
                strokeWidth={1.3}
                strokeDasharray="5 4"
                dot={false}
                isAnimationActive={false}
              />
            )}
            <ReferenceLine
              x={lens.point.date}
              stroke="#a4adbb"
              strokeDasharray="3 4"
            />
            <ReferenceDot
              x={lens.point.date}
              y={lens.point.close}
              r={4}
              fill="#ff8550"
              stroke="#12161d"
              strokeWidth={2}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="time-lens">
        <div className="lens-heading">
          <label htmlFor="session-lens">TIME LENS</label>
          <span>Inspect a session</span>
          <output htmlFor="session-lens">{labelDate(lens.point.date)}</output>
        </div>
        <input
          id="session-lens"
          type="range"
          min="0"
          max={history.length - 1}
          value={index}
          onChange={(e) => setIndex(Number(e.target.value))}
          aria-valuetext={`${labelDate(lens.point.date)}, close ${price(lens.point.close)} US dollars`}
        />
        <div className="lens-readings">
          <span>
            PRICE / SMA 20
            <strong
              className={lens.sma20Distance >= 0 ? "positive" : "negative"}
            >
              {delta(lens.sma20Distance)}
            </strong>
          </span>
          <span>
            PRICE / SMA 50
            <strong
              className={lens.sma50Distance >= 0 ? "positive" : "negative"}
            >
              {delta(lens.sma50Distance)}
            </strong>
          </span>
          <p>
            Historical readings.
            <br />
            The forecast uses the latest available session.
          </p>
        </div>
      </div>
    </>
  );
}
