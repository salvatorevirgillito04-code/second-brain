# Progetto futuro: trading su oro e Forex

Stato: **preparato, non attivo**. Ci sono agenti, skill e connettori pronti. Niente ordini automatici con denaro reale.

## Principi
- Le fasi vanno in ordine: dati e analisi, poi backtest, poi conto **demo**, e solo dopo una decisione dell'utente il conto reale (che resta sempre manuale).
- Nessun agente esegue ordini reali. Ogni operazione passa prima dal `guardiano-rischio`.
- Nessuna credenziale del broker nel repository: il token si inserisce con il modulo sicuro dell'ambiente, solo per il conto demo.
- I CFD e il Forex con leva fanno perdere denaro alla maggior parte dei clienti al dettaglio (le avvertenze obbligatorie ESMA dei broker indicano di solito il 70–80%). Le analisi automatiche non sono una consulenza finanziaria.

## Connettori
| Connettore | Uso | Stato |
|---|---|---|
| Alpha Vantage | prezzi XAU/USD e Forex, storici, indicatori, macro, sentiment delle notizie | **collegato, provato il 14/11/2026** (XAU/USD 3883,20 $, EUR/USD 1,10284 alle 01:20 UTC) |
| Supabase (piano gratuito) | archivio storico dei prezzi, segnali e diario consultabili da app | collegato, da configurare |
| Google Drive | report mensili e backup del diario | collegato |
| Claude Docs | brief giornaliero leggibile dal telefono | collegato |
| Broker in demo (es. OANDA v20 REST, documentata, conto di prova gratuito) | prezzi eseguibili e ordini **solo demo** | da decidere: serve un token del conto demo |

Le piattaforme MetaTrader 4/5 non hanno un'API web ufficiale per Claude: le escluderei.

## Agenti (`.claude/agents/`)
- `analista-mercati`: brief giornaliero e livelli chiave;
- `collaudatore-strategie`: backtest critici, con il verdetto più alto possibile «idonea al conto demo»;
- `guardiano-rischio`: blocca le operazioni fuori regola;
- `ricercatore`: broker, costi, regolamentazione.

## Skill (`.claude/skills/`)
`dati-mercato`, `brief-mercati`, `backtest`, `gestione-rischio`, `diario-operazioni`.

## Quando lo attiverai
1. Crea in Second Brain la stanza «Trading oro e Forex».
2. Crea un repository dedicato (es. `trading-lab`) con la cartella `trading/` che le skill usano, e aggiungilo alla sessione.
3. Attività pianificata «Brief mercati»: giorni feriali alle 07:40, ora di Roma, prima dell'apertura di Londra.
4. Backtest di 1–2 strategie semplici (es. trend con EMA 50/200 e filtro ATR su XAU/USD) con il `collaudatore-strategie`.
5. Almeno 3 mesi di conto demo con il diario prima di qualsiasi decisione sul conto reale.
