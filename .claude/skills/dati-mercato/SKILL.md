---
name: dati-mercato
description: Scarica prezzi di oro (XAU/USD) e coppie Forex, indicatori tecnici e dati macro dal connettore Alpha Vantage, con cache per non sprecare le richieste gratuite. Usala per qualunque analisi, backtest o brief sul trading di oro e Forex.
---
Fonte: connettore **Alpha Vantage** (dati reali; il piano gratuito ha un limite giornaliero di richieste, quindi usa la cache).
- Oro: `GOLD_SILVER_SPOT` (XAU), `GOLD_SILVER_HISTORY`.
- Forex: `CURRENCY_EXCHANGE_RATE` (bid/ask), `FX_DAILY`, `FX_WEEKLY`, `FX_INTRADAY`.
- Macro che muovono l'oro e il dollaro: `CPI`, `INFLATION`, `FEDERAL_FUNDS_RATE`, `TREASURY_YIELD`, `NONFARM_PAYROLL`, `REAL_GDP`.
- Indicatori: `RSI`, `MACD`, `ATR`, `BBANDS`, `EMA`, `ADX`. Notizie: `NEWS_SENTIMENT` (es. topics `economy_monetary`, tickers `FOREX:USD`).
Regole:
1. Prima di ogni chiamata controlla la cache `trading/cache/<funzione>-<simbolo>-<intervallo>.json`. I dati giornalieri valgono fino alla chiusura successiva, quelli macro una settimana.
2. Annota sempre fonte, ora UTC e fuso. Non inventare mai un prezzo: se la chiamata fallisce, scrivi «dato non disponibile».
3. I prezzi spot sono indicativi: non sono quotazioni eseguibili di un broker.
