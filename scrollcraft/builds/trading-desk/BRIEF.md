# TrendCast trading desk

Self-authored under explicit creative delegation.

## Evidence and authority

User: "quero que o faças de forma invovadora e trading vibes tipo um gajo que vê os graficos e fica tipo wow"

Existing product: React/Flask/PostgreSQL stock-direction predictor for an IST student's portfolio. Working ticker-specific models for AAPL, MSFT, GOOGL and NVDA. No trading execution. Recent explicit preferences: empty symbol field; remove workspace card, sidebar stack/project blurb, research badge and chart-horizon filler. Preserve those removals.

## Eight topics

1. Vibe: authored decision, technical, nocturnal, confident, precise. Actual charts are the imagery; no invented exchange/portfolio telemetry.
2. Journey: authored decision, choose an asset, see its price history, move through a historical session, read the next-session model score, audit its holdout, choose the next asset.
3. Energy: authored decision, quiet controls, one dominant chart, precise reactive inspection, restrained proof, an available input at the close.
4. Feeling: authored curve below. Peak: the historical crosshair turns a price curve into a live readout of the close, moving-average distances and daily change.
5. Signature move: authored decision, Time Lens. Pointer/keyboard timeline inspection links the crosshair, actual closing price, two indicator spreads and daily change. Historical values are not presented as historical predictions.
6. Range: authored decision, dense editorial trading surface. Off-black/navy, copper price trace, green/red only for actual direction, two font families, no glow/gradient text.
7. Structure: authored decision, distinct functional surfaces using Live surface grammar. Natural scroll, no video flythrough and no forced marketing hero.
8. Assets: existing real API history/CSV, trained model metadata, logo/name. No generated images or videos, no paid asset calls.

## Grammar

Live surface. Its actual app navigation and real controls are the content. Rejected: filmic one-shot and continuous world hide the tool; editorial/poster prioritize copy; gallery prioritizes objects; cutlist fragments analysis; split stage duplicates the price reading. No marketing hero, scrub video, spotlight, kinetic stack or giant slogan.

## Feeling curve, before acts

- Orientation: compact working controls and clear source/as-of labels.
- Curiosity: the real copper price curve owns the largest visual region.
- Control (peak): moving the Time Lens changes verified historical readouts together.
- Trust: the next-session score is separated from holdout results and baseline.
- Readiness: the closing control returns to the working symbol input for the next analysis.

Peak sentence: "I moved through the chart and the whole signal readout followed the actual trading session."
Tell-someone sentence: "It's the site where you can open up a price curve and inspect what the moving averages were saying that day."

## Score

| Beat | Device | Why |
| --- | --- | --- |
| Orientation | Natural flow and entry reveal | Immediate controls, no scroll tax |
| Chart | Background-only restrained parallax | Technical grid has depth; data/text remain stable |
| Control | Bespoke Time Lens pointer/range | The peak is actual analysis under the visitor's hand |
| Trust | Wipe/reveal with a static, accurate session count | Proof comes into view without invented results |
| Close | Actual input in normal flow | Resolve into the next usable action |

The chart gets the most room, not an artificial pin duration. No authored dead-scroll hold. Reduced motion keeps all data and controls; mobile stacks chart before its score and uses a 44px timeline control.

## Fingerprint

First registered build in this repository. Registry empty; no previous row to repeat. Dimensions: live surface / left tool rail / real area-and-SMA chart / inspect-forecast-audit-command / working symbol input / linked historical Time Lens.

## Review

The brief was self-authored from the user's creative delegation. Live surface won because this is a working analysis tool. The chart is the peak; opening controls stay quiet and the ending returns to the actual input. Four treatments are used: entry reveals, background parallax, an evidence wipe, and the bespoke historical Time Lens. No forced pinned scenes.

Feel-check: the initial composition delivered orientation, curiosity and control. The scroll counter obscured the true holdout total, so it was replaced with a static value. Mobile now separates the chart and forecast, with bottom navigation and 44px inspection/toggle controls. Historical inspection never changes the next-session forecast.

Verified against the production Flask build at http://127.0.0.1:5003:
- Real forecasts for AAPL, MSFT, GOOGL and NVDA use their own training ticker; all three model types work.
- Time Lens values match API history. Pointer, keyboard, moving-average toggles, watchlist persistence, journal and error states passed local checks.
- Desktop 1440x900, phone 390x844, compact 360x640 and reduced-motion contact sheets were visually reviewed. No horizontal page overflow, runtime errors or failed resources in final runs.
- The engine and its stylesheet are copied unchanged. No generated imagery, video or paid asset calls.
- Earlier favicon 404 findings were resolved by bundling the icon under the existing /assets route. Final verified-* runs supersede the earlier screenshots; local evidence and tests stay outside Git.

Limits: phone sizes are browser simulations, not physical-device checks. The Vite build retains its large-chunk warning (about 193 kB compressed JavaScript). Model quality is unchanged; this work improves the analysis interface. No deployment or merge.

Follow-up: removed the model menu. The API now picks the available ticker-specific model with the highest holdout accuracy and records how it was selected. The panel still names that model. Local checks covered all four automatic selections, missing model files, equal scores, baseline exclusion and the simplified responsive form.
