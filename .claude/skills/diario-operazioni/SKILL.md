---
name: diario-operazioni
description: Registra e rivede le operazioni (demo o reali dichiarate dall'utente): motivo, ingresso, stop, uscita, risultato, errori. Usala quando l'utente apre o chiude un'operazione o chiede la revisione settimanale.
---
- Una riga per operazione in `trading/diario/<anno>-<mese>.csv`, con: data UTC, strumento, direzione, dimensione, ingresso, stop, obiettivo, uscita, risultato in R e in valuta, strategia, conto (demo o reale), note.
- Revisione settimanale: risultato in R, rispetto delle regole di rischio, errori ricorrenti, una sola modifica proposta.
- Nessuna credenziale del broker nel diario o nel repository.
