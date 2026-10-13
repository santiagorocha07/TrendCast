export function sessionLens(history, index) {
  if (!history.length) return null;
  const selected = Math.max(0, Math.min(history.length - 1, index));
  const point = history[selected];
  const previous = history[selected - 1];
  return {
    point,
    dailyReturn: previous?.close > 0 ? point.close / previous.close - 1 : null,
    sma20Distance: point.sma20 > 0 ? point.close / point.sma20 - 1 : null,
    sma50Distance: point.sma50 > 0 ? point.close / point.sma50 - 1 : null,
  };
}
