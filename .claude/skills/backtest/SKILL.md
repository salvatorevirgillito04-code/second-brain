---
name: backtest
description: Verifica una strategia su oro o Forex con dati storici, includendo spread, commissioni e slittamento, con prova fuori campione. Usala prima di considerare valida qualunque strategia, anche in conto demo.
---
1. Scrivi la strategia come regole esplicite (ingresso, uscita, stop, dimensione) in `trading/strategie/<nome>.md`.
2. Dati da `dati-mercato`. Dividi il periodo: 70% per costruire, 30% fuori campione da toccare una sola volta. Se puoi, fai un walk-forward.
3. Script Python (pandas) in `trading/backtest/`. Niente look-ahead: i segnali usano solo barre chiuse. Includi i costi: spread tipico (XAU/USD ~0,3 $, EUR/USD ~0,1 pip), commissioni e 1 tick di slittamento.
4. Riporta: numero di operazioni, rendimento, massimo drawdown, profit factor, percentuale di vincite, Sharpe, e il confronto con il semplice possesso.
5. Strategia scartata se: meno di 100 operazioni, risultato fuori campione nettamente peggiore, drawdown oltre il 20%.
6. Un backtest non è una previsione: dillo sempre nel risultato.
