---
name: gestione-rischio
description: Calcola dimensione della posizione, stop e limiti di perdita per oro e Forex, e blocca le operazioni fuori regola. Usala prima di ogni operazione, anche simulata.
---
Regole predefinite (le cambia solo l'utente):
- rischio massimo per operazione 1% del conto; perdita massima giornaliera 3%; settimanale 6%. Oltre questi limiti si ferma tutto fino al giorno o alla settimana dopo;
- stop obbligatorio, basato sulla volatilità (es. 1,5 × ATR 14);
- dimensione = (conto × rischio%) / (distanza dello stop × valore del punto). Arrotonda per difetto;
- leva effettiva massima 1:5; niente operazioni nei 15 minuti attorno a dati macro di alto impatto (CPI, NFP, decisioni Fed/BCE);
- al massimo 2 posizioni correlate (es. EUR/USD e GBP/USD contano come esposizione al dollaro).
Se una regola non è rispettata, rispondi «operazione bloccata: <regola>».
