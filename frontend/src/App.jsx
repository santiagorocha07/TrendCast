import React, { useEffect, useRef, useState } from "react";
import { api } from "./api.js";
import MarketChart from "./MarketChart.jsx";
import "../../scrollcraft/builds/trading-desk/scrollcraft.js";

const modelNames = {
  random_forest: "Random Forest",
  logistic_regression: "Logistic Regression",
  lstm: "LSTM",
};
const percent = (value) => `${(value * 100).toFixed(1)}%`;
const date = (value) =>
  new Date(`${value}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
const stockNames = {
  AAPL: "Apple",
  MSFT: "Microsoft",
  GOOGL: "Alphabet",
  NVDA: "NVIDIA",
};

function Icon({ name }) {
  const paths = {
    desk: "M3 17l5-6 4 3 9-11M3 21h18",
    models: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
    history: "M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2",
    arrow: "M5 19L19 5M5 5h14v14",
  };
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}

function Score({ result, busy }) {
  const score = result?.probability_up;
  return (
    <aside className="signal-panel" aria-label="Next-session forecast">
      <div className="panel-heading">
        <span>Next session</span>
        <span className="mono">{result?.ticker || "NO SIGNAL"}</span>
      </div>
      <div className="score-gauge">
        <svg viewBox="0 0 240 145" aria-hidden="true">
          <path
            d="M25 120a95 95 0 0 1 190 0"
            fill="none"
            stroke="var(--line)"
            strokeWidth="12"
          />
          {result && (
            <path
              d="M25 120a95 95 0 0 1 190 0"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="12"
              pathLength="100"
              strokeDasharray={`${score * 100} 100`}
            />
          )}
        </svg>
        <div className="gauge-value">
          <strong>{result ? percent(score) : "· · ·"}</strong>
          <span>
            {result
              ? "MODEL UP SCORE"
              : busy
                ? "ANALYSING"
                : "AWAITING ANALYSIS"}
          </span>
        </div>
      </div>
      {result ? (
        <>
          <h2 className={result.direction === "up" ? "positive" : "negative"}>
            {result.direction === "up" ? "Upward" : "Down / flat"}
            <Icon name="arrow" />
          </h2>
          <p className="signal-copy">
            Direction of the next close after {date(result.as_of)}.
          </p>
          <dl className="signal-details">
            <div>
              <dt>Model</dt>
              <dd>{modelNames[result.model]}</dd>
            </div>
            <div>
              <dt>Trained on</dt>
              <dd>{result.training_ticker}</dd>
            </div>
            <div>
              <dt>Holdout accuracy</dt>
              <dd>{percent(result.evaluation.accuracy)}</dd>
            </div>
            <div>
              <dt>Majority baseline</dt>
              <dd>{percent(result.baseline_accuracy)}</dd>
            </div>
          </dl>
          <p className="muted small">
            Selected by historical holdout accuracy. This uncalibrated score is
            not a measured chance of profit.
          </p>
        </>
      ) : (
        <>
          <h2>Find your next signal.</h2>
          <p className="signal-copy">
            Choose a symbol and run its own trained model. The chart is a saved
            AAPL preview.
          </p>
          <p className="muted small">No price targets. No simulated returns.</p>
        </>
      )}
    </aside>
  );
}

export default function App() {
  const [ticker, setTicker] = useState("");
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
  const [preview, setPreview] = useState(null);
  const surface = useRef(null);
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    let active = true;
    api("/history/AAPL?source=demo&period=6mo")
      .then((data) => {
        if (active) setPreview(data);
      })
      .catch((e) => {
        if (active) setNotice(e.message);
      });
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
      const info = await api(
        `/models?${new URLSearchParams({ ticker: selectedTicker.trim() })}`,
      );
      if (id !== requestId.current) return;
      setMetrics(info);
      const data = await api(
        `/predict/${encodeURIComponent(selectedTicker.trim())}?${new URLSearchParams({ period, source })}`,
      );
      if (id !== requestId.current) return;
      setResult(data);
      setTicker(data.ticker);
      setTab("overview");
      setNotice("");
      setBusy(false);
      try {
        const history = await api("/predictions");
        if (id === requestId.current) setSaved(history.predictions);
      } catch (e) {
        if (id === requestId.current)
          setNotice(
            `Forecast ready, but saved forecasts could not be refreshed: ${e.message}`,
          );
      }
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

  useEffect(() => {
    const motion = window.ScrollCraft.mount(surface.current);
    return () => motion.destroy();
  }, [tab, result, preview, metrics]);

  const up = result?.direction === "up";
  const modelRows = metrics
    ? Object.entries(metrics.models).sort(
        ([a], [b]) => (a === "baseline") - (b === "baseline"),
      )
    : [];

  const chart = result || preview;
  return (
    <div className="app-shell" ref={surface}>
      <aside className="tool-rail">
        <a className="brand-symbol" href="/" aria-label="TrendCast home">
          <Icon name="arrow" />
        </a>
        <nav aria-label="Workspace">
          {[
            ["overview", "desk", "Desk"],
            ["models", "models", "Models"],
            ["history", "history", "Journal"],
          ].map(([id, icon, label]) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
              aria-current={tab === id ? "page" : undefined}
            >
              <Icon name={icon} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <span className="rail-avatar" aria-label="Santiago">
          S
        </span>
      </aside>
      <main>
        <header className="topbar">
          <a href="/" className="wordmark">
            TrendCast<span>.</span>
          </a>
          <span className="topbar-location">
            {tab === "overview"
              ? "Market desk"
              : tab === "models"
                ? "Model lab"
                : "Forecast journal"}
          </span>
          <span className="topbar-hint">Direction, backed by data</span>
        </header>
        <div className="content">
          <section className="command" data-sc-act="flow">
            <form onSubmit={predict} className="command-form" data-sc-in>
              <label className="symbol-field">
                Stock symbol
                <input
                  id="stock-symbol"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  placeholder="e.g. AAPL"
                  autoComplete="off"
                  maxLength={15}
                  required
                />
              </label>
              <label>
                Range
                <select
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                >
                  {[
                    ["3mo", "3 months"],
                    ["6mo", "6 months"],
                    ["1y", "1 year"],
                    ["2y", "2 years"],
                    ["5y", "5 years"],
                  ].map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Data
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                >
                  <option value="live">Yahoo Finance</option>
                  <option value="demo">Saved AAPL</option>
                </select>
              </label>
              <button className="primary" disabled={busy}>
                {busy ? "Analysing…" : "Run analysis"}
                <Icon name="arrow" />
              </button>
            </form>
            <div className="quick-picks">
              <span>TRAINED SYMBOLS</span>
              {Object.keys(stockNames).map((item) => (
                <button
                  key={item}
                  disabled={busy}
                  onClick={() => predict(null, item)}
                >
                  {item}
                  <span>{stockNames[item]}</span>
                </button>
              ))}
            </div>
          </section>
          {error && (
            <div className="message error" role="alert">
              {error}
            </div>
          )}
          {notice && (
            <div className="message" role="status">
              {notice}
            </div>
          )}
          {tab === "overview" && (
            <>
              <section
                className="desk-scene"
                data-sc-act="flow"
                aria-busy={busy}
              >
                <div
                  className="desk-grid"
                  data-sc-parallax="-0.025"
                  aria-hidden="true"
                />
                <div className="chart-panel">
                  <div className="instrument-heading">
                    <div>
                      <span className="instrument-name">
                        {stockNames[chart?.ticker] ||
                          chart?.ticker ||
                          "Market history"}
                      </span>
                      <h1>
                        {chart?.ticker || "Loading"}
                        <span className="mono">USD</span>
                      </h1>
                    </div>
                    <div className="instrument-actions">
                      {result && (
                        <button
                          onClick={() => toggleFavorite(result.ticker)}
                          aria-label={`${favorites.includes(result.ticker) ? "Remove" : "Add"} ${result.ticker} ${favorites.includes(result.ticker) ? "from" : "to"} watchlist`}
                        >
                          {favorites.includes(result.ticker)
                            ? "★ Saved"
                            : "☆ Watch"}
                        </button>
                      )}
                      <span className="data-tag">
                        {result
                          ? result.source.replaceAll("_", " ")
                          : "Saved-data preview"}
                      </span>
                    </div>
                  </div>
                  {chart ? (
                    <MarketChart
                      key={`${chart.ticker}-${chart.source}-${chart.history.length}`}
                      history={chart.history}
                    />
                  ) : (
                    <div className="chart-loading">
                      Loading the saved chart…
                    </div>
                  )}
                  <div className="chart-provenance">
                    <span>
                      Adjusted closes · {chart?.history.length || 0} sessions
                    </span>
                    <span>
                      {chart?.history.length
                        ? `Data through ${date(chart.history.at(-1).date)}`
                        : ""}
                    </span>
                  </div>
                </div>
                <Score result={result} busy={busy} />
              </section>
              {result?.warning && (
                <div className="message" role="status">
                  {result.warning}
                </div>
              )}
              {result?.historical_replay && (
                <div className="message">
                  Historical replay: this price session is covered by the
                  production model's training data.
                </div>
              )}
              <section className="evidence" data-sc-act="flow">
                <div className="evidence-heading" data-sc-in>
                  <h2>Look past the signal.</h2>
                  <p>
                    {metrics?.training_ticker || "Selected stock"} models,
                    measured against the same chronological holdout.
                  </p>
                  <button
                    className="text-button"
                    onClick={() => setTab("models")}
                  >
                    Open model lab <Icon name="arrow" />
                  </button>
                </div>
                <div
                  className="performance"
                  data-sc-reveal="left"
                  data-sc-reveal-at="0 0.15"
                >
                  {modelRows.map(([name, value]) => (
                    <div className="performance-row" key={name}>
                      <span>{modelNames[name] || "Majority baseline"}</span>
                      <div className="performance-track">
                        <i style={{ width: percent(value.accuracy) }} />
                      </div>
                      <strong className="mono">
                        {percent(value.accuracy)}
                      </strong>
                    </div>
                  ))}
                </div>
                <div className="evidence-note">
                  <span className="holdout-number">
                    {metrics?.test.rows || 0}
                  </span>
                  <p>
                    Unseen sessions in the holdout.
                    <br />
                    <span>
                      {metrics
                        ? `${date(metrics.test.start)} to ${date(metrics.test.end)}`
                        : "Loading evaluation"}
                    </span>
                  </p>
                  <p>
                    Accuracy near the baseline is no demonstrated edge.
                    <br />
                    <span>A model score is not a trading strategy.</span>
                  </p>
                </div>
              </section>
              <section className="watchlist-section">
                <div>
                  <h2>Your watchlist</h2>
                  <p>Saved in this browser session.</p>
                </div>
                <div className="watch-items">
                  {favorites.length ? (
                    favorites.map((item) => (
                      <div key={item}>
                        <button
                          disabled={busy}
                          onClick={() => predict(null, item)}
                        >
                          {item}
                          <Icon name="arrow" />
                        </button>
                        <button
                          aria-label={`Remove ${item} from watchlist`}
                          onClick={() => toggleFavorite(item)}
                        >
                          ×
                        </button>
                      </div>
                    ))
                  ) : (
                    <span className="muted">
                      Run an analysis, then save its symbol.
                    </span>
                  )}
                </div>
              </section>
              <footer className="desk-ending">
                <span>Another chart. Another question.</span>
                <button
                  className="text-button"
                  onClick={() => {
                    document.getElementById("stock-symbol").focus();
                    document.getElementById("stock-symbol").scrollIntoView({
                      block: "center",
                      behavior: window.ScrollCraft.reduce
                        ? "instant"
                        : "smooth",
                    });
                  }}
                >
                  Choose next stock <Icon name="arrow" />
                </button>
              </footer>
            </>
          )}
          {tab === "models" && (
            <section className="lab" data-sc-act="flow">
              <div className="section-title">
                <h1>Test the signal.</h1>
                <span className="mono">{metrics?.training_ticker}</span>
              </div>
              <p>
                Same stock. Same holdout. Each model learns from the past before
                it sees the test.
              </p>
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
                        <td>{modelNames[name] || "Majority baseline"}</td>
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
                    Test: {date(metrics.test.start)} to {date(metrics.test.end)}{" "}
                    · {metrics.test.rows} sessions · one-session gap. Production
                    refit through {date(metrics.production_training_end)}.
                  </p>
                  <div className="matrices">
                    {modelRows
                      .filter(([name]) => name !== "baseline")
                      .map(([name, value]) => (
                        <div key={name}>
                          <h3>{modelNames[name]}</h3>
                          <p>Actual rows / predicted columns</p>
                          <table>
                            <thead>
                              <tr>
                                <th>Actual</th>
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
              <p className="evaluation-note">
                Scores are uncalibrated. Holdout accuracy does not establish
                profitable trading.
              </p>
            </section>
          )}
          {tab === "history" && (
            <section className="lab">
              <div className="section-title">
                <h1>Forecast journal.</h1>
                <span className="mono">{saved.length} entries</span>
              </div>
              <p>The last 30 saved forecasts for this browser session.</p>
              {saved.length ? (
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Stock / model</th>
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
                          <td
                            className={
                              item.direction === "up" ? "positive" : "negative"
                            }
                          >
                            {item.direction === "up" ? "Up" : "Down / flat"}
                          </td>
                          <td>{percent(item.probability_up)}</td>
                          <td>{item.source.replaceAll("_", " ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="journal-empty">
                  Your first analysis starts the journal.
                </div>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
