import React, { useEffect, useRef, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "./api.js";

const modelNames = {
  random_forest: "Random Forest",
  logistic_regression: "Logistic Regression",
  lstm: "LSTM",
};
const percent = (value) => `${(value * 100).toFixed(1)}%`;
const money = (value) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value);
const date = (value) =>
  new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

export default function App() {
  const [ticker, setTicker] = useState("AAPL");
  const [model, setModel] = useState("random_forest");
  const [period, setPeriod] = useState("6mo");
  const [source, setSource] = useState("live");
  const [result, setResult] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [saved, setSaved] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const requestId = useRef(0);
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    let active = true;
    api("/models")
      .then((data) => {
        if (active) setMetrics(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    api("/favorites")
      .then((data) => {
        if (active) setFavorites(data.favorites);
      })
      .catch((e) => {
        if (active) setNotice(e.message);
      });
    api("/predictions")
      .then((data) => {
        if (active) setSaved(data.predictions);
      })
      .catch((e) => {
        if (active) setNotice(e.message);
      });
    return () => {
      active = false;
      requestId.current += 1;
    };
  }, []);

  async function predict(event, selectedTicker = ticker) {
    event?.preventDefault();
    const id = ++requestId.current;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const data = await api(
        `/predict/${encodeURIComponent(selectedTicker.trim())}?${new URLSearchParams({ model, period, source })}`,
      );
      if (id !== requestId.current) return;
      setResult(data);
      setTicker(data.ticker);
      setTab("overview");
      setNotice("");
      const history = await api("/predictions");
      if (id === requestId.current) setSaved(history.predictions);
    } catch (e) {
      if (id === requestId.current) setError(e.message);
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  }

  async function toggleFavorite(selectedTicker) {
    try {
      const data = await api(
        `/favorites/${encodeURIComponent(selectedTicker)}`,
        { method: favorites.includes(selectedTicker) ? "DELETE" : "PUT" },
      );
      setFavorites(data.favorites);
      setNotice("");
    } catch (e) {
      setNotice(e.message);
    }
  }

  const up = result?.direction === "up";
  const available = metrics?.available_models || ["random_forest"];
  const modelRows = metrics ? Object.entries(metrics.models) : [];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="/" aria-label="TrendCast home">
          <span className="brand-mark">↗</span>TrendCast
          <span className="brand-dot">.</span>
        </a>
        <div className="workspace">
          <span className="workspace-icon">TC</span>
          <div>
            Market workspace<small>Personal research project</small>
          </div>
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Workspace">
          {[
            ["overview", "◫", "Market overview"],
            ["models", "⌘", "Model comparison"],
            ["history", "↺", "Saved forecasts"],
          ].map(([id, icon, label]) => (
            <button
              key={id}
              className={`nav-item ${tab === id ? "active" : ""}`}
              onClick={() => setTab(id)}
            >
              <span>{icon}</span>
              {label}
              {id === "history" && <b>{saved.length}</b>}
            </button>
          ))}
        </nav>
        <div className="watchlist">
          <p className="nav-label">
            YOUR WATCHLIST{" "}
            <span>{favorites.length.toString().padStart(2, "0")}</span>
          </p>
          {favorites.length ? (
            favorites.map((item) => (
              <div className="watch-row" key={item}>
                <button disabled={busy} onClick={() => predict(null, item)}>
                  {item}
                  <span>View forecast ↗</span>
                </button>
                <button
                  className="remove"
                  aria-label={`Remove ${item} from watchlist`}
                  onClick={() => toggleFavorite(item)}
                >
                  ×
                </button>
              </div>
            ))
          ) : (
            <p className="sidebar-hint">
              Save a ticker after running a forecast. Your list stays in this
              browser session.
            </p>
          )}
        </div>
        <div className="sidebar-bottom">
          <span className="status-dot" /> Built to explore, not to trade.
          <p>Python · React · PostgreSQL</p>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <span>
            Workspace <span className="breadcrumb">/</span>{" "}
            {tab === "models"
              ? "Models"
              : tab === "history"
                ? "Forecasts"
                : "Overview"}
          </span>
          <div className="research-badge">
            <span className="status-dot" /> Research edition{" "}
            <span className="avatar">S</span>
          </div>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">A LITTLE SIGNAL. A LOT OF PERSPECTIVE.</p>
              <h1>
                {tab === "models"
                  ? "Put the models to the test."
                  : tab === "history"
                    ? "Your forecast notebook."
                    : "Where is the market heading?"}
              </h1>
              <p>
                Explore the next session’s direction. See the data behind every
                forecast.
              </p>
            </div>
            <span className="edition">TRENDCAST / 01</span>
          </div>
          {notice && (
            <div className="notice" role="status">
              {notice}
            </div>
          )}
          {tab === "overview" && (
            <>
              <form className="search-panel" onSubmit={predict}>
                <label className="ticker-input">
                  STOCK SYMBOL
                  <div>
                    <span className="search-icon">⌕</span>
                    <input
                      aria-label="Stock symbol"
                      value={ticker}
                      onChange={(e) => setTicker(e.target.value.toUpperCase())}
                      maxLength={15}
                      required
                      placeholder="e.g. AAPL"
                    />
                  </div>
                </label>
                <label>
                  MODEL
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                  >
                    {available.map((name) => (
                      <option key={name} value={name}>
                        {modelNames[name]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  CHART RANGE
                  <select
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                  >
                    {["3mo", "6mo", "1y", "2y", "5y"].map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  DATA SOURCE
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                  >
                    <option value="live">Yahoo Finance</option>
                    <option value="demo">Saved AAPL demo</option>
                  </select>
                </label>
                <button className="primary" disabled={busy} type="submit">
                  {busy ? (
                    "Reading the market…"
                  ) : (
                    <>
                      Run forecast <span>↗</span>
                    </>
                  )}
                </button>
              </form>
              <div className="quick-picks">
                <span>Explore</span>
                {["AAPL", "MSFT", "GOOGL", "NVDA"].map((item) => (
                  <button
                    disabled={busy}
                    key={item}
                    onClick={() => predict(null, item)}
                  >
                    {item}
                  </button>
                ))}
                <span className="data-note">
                  Daily adjusted closes · next-session horizon
                </span>
              </div>
              {error && (
                <div className="error" role="alert">
                  {error}
                  {source === "live" && (
                    <button
                      onClick={() => {
                        setSource("demo");
                        setTicker("AAPL");
                      }}
                    >
                      Use the saved AAPL dataset
                    </button>
                  )}
                </div>
              )}
              <div aria-live="polite" aria-busy={busy}>
                {result ? (
                  <>
                    <div className="asset-heading">
                      <div>
                        <span className="ticker-tag">{result.ticker}</span>
                        <span>
                          {result.ticker === "AAPL"
                            ? "Apple Inc."
                            : "Stock overview"}{" "}
                          <small>· adjusted close</small>
                        </span>
                      </div>
                      <button
                        className="favorite-button"
                        onClick={() => toggleFavorite(result.ticker)}
                      >
                        {favorites.includes(result.ticker)
                          ? "★ Watching"
                          : "☆ Add to watchlist"}
                      </button>
                    </div>
                    {(result.warning ||
                      result.experimental_ticker ||
                      result.historical_replay) && (
                      <div className="notice">
                        {result.warning}{" "}
                        {result.experimental_ticker &&
                          "This model was trained on AAPL. Results for other tickers are experimental."}{" "}
                        {result.historical_replay &&
                          "Historical replay: this date is included in production training; this forecast is not an out-of-sample result."}
                      </div>
                    )}
                    <section
                      className="stat-grid"
                      aria-label="Forecast summary"
                    >
                      <div className="stat">
                        <p>LATEST ADJUSTED CLOSE</p>
                        <h2>${money(result.close)}</h2>
                        <span
                          className={
                            result.daily_return >= 0 ? "positive" : "negative"
                          }
                        >
                          {result.daily_return >= 0 ? "+" : ""}
                          {result.daily_return.toFixed(2)}%{" "}
                          <small>last session</small>
                        </span>
                      </div>
                      <div className="stat">
                        <p>NEXT-SESSION DIRECTION</p>
                        <h2 className={up ? "positive" : "negative"}>
                          {up ? "↗ Upward" : "↘ Down / flat"}
                        </h2>
                        <span>
                          {modelNames[result.model]}{" "}
                          <small>· direction only</small>
                        </span>
                      </div>
                      <div className="stat">
                        <p>MODEL SCORE · UP</p>
                        <h2>{percent(result.probability_up)}</h2>
                        <div className="probability-track">
                          <span
                            style={{ width: percent(result.probability_up) }}
                          />
                        </div>
                        <span>
                          <small>Uncalibrated probability</small>
                        </span>
                      </div>
                      <div className="stat">
                        <p>HOLDOUT ACCURACY</p>
                        <h2>
                          {result.evaluation
                            ? percent(result.evaluation.accuracy)
                            : "—"}
                        </h2>
                        <span>
                          Baseline: {percent(result.baseline_accuracy)}{" "}
                          <small>· AAPL only</small>
                        </span>
                      </div>
                    </section>
                    <section className="chart-card">
                      <div className="section-heading">
                        <div>
                          <h3>Price & moving averages</h3>
                          <p>
                            {result.ticker} · {date(result.history[0].date)} —{" "}
                            {date(result.as_of)}
                          </p>
                        </div>
                        <div className="chart-legend">
                          <span>
                            <i className="legend-close" />
                            Close
                          </span>
                          <span>
                            <i className="legend-20" />
                            SMA 20
                          </span>
                          <span>
                            <i className="legend-50" />
                            SMA 50
                          </span>
                        </div>
                      </div>
                      <div
                        className="chart"
                        role="img"
                        aria-label={`${result.ticker} daily adjusted closing prices with 20 and 50 session moving averages. Latest close ${money(result.close)}.`}
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={result.history}
                            margin={{ top: 12, right: 15, left: 0, bottom: 8 }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 5"
                              vertical={false}
                              stroke="#e7e8e2"
                            />
                            <XAxis
                              dataKey="date"
                              minTickGap={55}
                              tickFormatter={(v) =>
                                new Date(`${v}T12:00:00`).toLocaleDateString(
                                  "en-US",
                                  { month: "short", day: "numeric" },
                                )
                              }
                              tickLine={false}
                              axisLine={false}
                              tick={{ fontSize: 11, fill: "#7b8177" }}
                            />
                            <YAxis
                              domain={["auto", "auto"]}
                              tickFormatter={(v) => `$${Math.round(v)}`}
                              width={55}
                              tickLine={false}
                              axisLine={false}
                              tick={{ fontSize: 11, fill: "#7b8177" }}
                            />
                            <Tooltip
                              labelFormatter={date}
                              formatter={(v, name) => [`$${money(v)}`, name]}
                              contentStyle={{
                                borderRadius: 10,
                                border: "1px solid #ddd",
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="close"
                              name="Close"
                              stroke="#455e43"
                              strokeWidth={2.2}
                              dot={false}
                              isAnimationActive={false}
                            />
                            <Line
                              dataKey="sma20"
                              name="SMA 20"
                              stroke="#ca9858"
                              strokeWidth={1.6}
                              dot={false}
                              isAnimationActive={false}
                            />
                            <Line
                              dataKey="sma50"
                              name="SMA 50"
                              stroke="#a8b0a0"
                              strokeWidth={1.5}
                              strokeDasharray="5 4"
                              dot={false}
                              isAnimationActive={false}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="chart-footer">
                        <span>
                          Source: {result.source.replaceAll("_", " ")} · prices
                          adjusted for corporate actions
                        </span>
                        <span>As of {date(result.as_of)}</span>
                      </div>
                    </section>
                    <div className="bottom-grid">
                      <section className="insight-card">
                        <span className="mini-label">HOW TO READ THIS</span>
                        <h3>A direction, not a destination.</h3>
                        <p>
                          The model uses price-to-moving-average ratios and
                          daily returns. It predicts whether the next close is
                          higher; it does not estimate a target price.
                        </p>
                        <button onClick={() => setTab("models")}>
                          See model performance <span>↗</span>
                        </button>
                      </section>
                      <section className="method-card">
                        <span className="mini-label">
                          KEEP THE BASELINE IN VIEW
                        </span>
                        <h3>
                          {result.evaluation &&
                          result.evaluation.accuracy > result.baseline_accuracy
                            ? "Above baseline on this test."
                            : "No edge over the baseline."}
                        </h3>
                        <p>
                          Evaluated on {result.test_period.rows} unseen AAPL
                          sessions, {date(result.test_period.start)} to{" "}
                          {date(result.test_period.end)}. A more complex model
                          is not automatically a better forecast.
                        </p>
                        <div className="method-tags">
                          <span>Chronological split</span>
                          <span>No price targets</span>
                        </div>
                      </section>
                    </div>
                  </>
                ) : (
                  <section className="empty-state">
                    <div className="empty-chart" aria-hidden="true">
                      <svg viewBox="0 0 360 100">
                        <path
                          d="M0 83L22 73L42 79L61 48L82 59L108 34L130 48L150 29L170 42L191 14L213 30L234 16L254 37L275 25L298 30L320 8L340 17L360 3"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                      </svg>
                    </div>
                    <p className="eyebrow">YOUR NEXT QUESTION STARTS HERE</p>
                    <h2>
                      {busy
                        ? "Preparing your forecast…"
                        : "Pick a stock. Explore the signal."}
                    </h2>
                    <p>
                      Run a forecast to see its history, predicted direction and
                      measured performance.
                      <br />
                      You can also explore the saved AAPL dataset without Yahoo
                      Finance.
                    </p>
                  </section>
                )}
              </div>
            </>
          )}
          {tab === "models" && (
            <section className="comparison-card">
              <div className="section-heading">
                <div>
                  <h3>Same data. Same test. Different approaches.</h3>
                  <p>
                    Training and model selection use only the past. The holdout
                    comes afterwards.
                  </p>
                </div>
                <span className="ticker-tag">AAPL</span>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Model</th>
                      <th>Accuracy</th>
                      <th>Macro F1</th>
                      <th>Vs. baseline</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modelRows.map(([name, value]) => (
                      <tr key={name}>
                        <td>
                          <strong>
                            {modelNames[name] || "Majority baseline"}
                          </strong>
                          <small>
                            {name === "baseline"
                              ? "Always predicts the training majority"
                              : name === "lstm"
                                ? "20-session sequence · 16 hidden units"
                                : name === "random_forest"
                                  ? "Tuned with chronological cross-validation"
                                  : "Scaled features · binary classifier"}
                          </small>
                        </td>
                        <td>{percent(value.accuracy)}</td>
                        <td>
                          {value.classification_report["macro avg"][
                            "f1-score"
                          ].toFixed(3)}
                        </td>
                        <td>
                          {name === "baseline"
                            ? "Reference"
                            : `${((value.accuracy - metrics.models.baseline.accuracy) * 100).toFixed(1)} pp`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {metrics && (
                <>
                  <p className="evaluation-note">
                    Test: {date(metrics.test.start)} — {date(metrics.test.end)}{" "}
                    · {metrics.test.rows} sessions · one-session gap. Production
                    models are then refitted through{" "}
                    {date(metrics.production_training_end)}.
                  </p>
                  <div className="matrices">
                    {modelRows
                      .filter(([name]) => name !== "baseline")
                      .map(([name, value]) => (
                        <div key={name}>
                          <h4>{modelNames[name]}</h4>
                          <p>Actual ↓ / predicted →</p>
                          <table className="matrix">
                            <thead>
                              <tr>
                                <th></th>
                                <th>Down / flat</th>
                                <th>Up</th>
                              </tr>
                            </thead>
                            <tbody>
                              {value.confusion_matrix.map((row, i) => (
                                <tr key={i}>
                                  <th>{i ? "Up" : "Down / flat"}</th>
                                  {row.map((n, j) => (
                                    <td key={j}>{n}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                  </div>
                </>
              )}
              <div className="notice">
                This is a learning project. Holdout accuracy does not establish
                a profitable trading strategy. Probabilities are uncalibrated,
                and results are not investment advice.
              </div>
            </section>
          )}
          {tab === "history" && (
            <section className="comparison-card">
              <div className="section-heading">
                <div>
                  <h3>Saved forecasts</h3>
                  <p>
                    Up to 30 recent entries for this browser session, stored in
                    PostgreSQL.
                  </p>
                </div>
                <span className="ticker-tag">{saved.length} entries</span>
              </div>
              {saved.length ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Ticker / model</th>
                        <th>Price date</th>
                        <th>Direction</th>
                        <th>Up score</th>
                        <th>Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {saved.map((item) => (
                        <tr
                          key={`${item.ticker}-${item.model}-${item.version}-${item.as_of}-${item.source}`}
                        >
                          <td>
                            <strong>{item.ticker}</strong>
                            <small>{modelNames[item.model]}</small>
                          </td>
                          <td>{date(item.as_of)}</td>
                          <td>
                            {item.direction === "up" ? "↗ Up" : "↘ Down / flat"}
                          </td>
                          <td>{percent(item.probability_up)}</td>
                          <td>{item.source.replaceAll("_", " ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="evaluation-note">
                  Run a forecast to start your notebook.
                </p>
              )}
            </section>
          )}
          <footer className="footer">
            <span>
              <strong>TrendCast.</strong> A market direction experiment.
            </span>
            <span>For learning & research. Not investment advice.</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
