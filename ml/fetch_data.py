"""Fase 1: descarregar, preparar, guardar e visualizar dados reais."""
import argparse

from .market import DATA, download_data, validate_ticker


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("ticker", nargs="?", default="AAPL", type=validate_ticker)
    parser.add_argument("--no-plot", action="store_true", help="Guardar o CSV sem abrir o gráfico")
    args = parser.parse_args()
    frame = download_data(args.ticker)
    frame.to_csv(DATA / f"{args.ticker}.csv", index_label="Date")
    print(frame[["Close", "SMA20", "SMA50"]].tail())
    if not args.no_plot:
        import matplotlib.pyplot as plt
        frame[["Close", "SMA20", "SMA50"]].plot(figsize=(12, 6))
        plt.title(f"{args.ticker} — fecho ajustado e médias móveis")
        plt.ylabel("USD")
        plt.show()


if __name__ == "__main__":
    main()
