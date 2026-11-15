# Registro delle automazioni del Brain

Lo legge ogni mattina l'attività «Brain – automazioni» (sessione «Second Brain-Stato»). Per ogni connettore **disponibile nella sessione** esegue la sua azione quotidiana; se un connettore non c'è, lo segna come «non collegato» e passa oltre. Quando colleghi uno dei connettori «pronti», viene usato dalla mattina dopo, senza altri passaggi.

Regole per tutte le azioni: **solo lettura**, niente costi o crediti, niente pubblicazioni, eliminazioni o push. Massimo 5 voci per sezione.

## Attivi
| Connettore | Azione quotidiana (sola lettura) |
|---|---|
| Sentry | problemi nuovi o in aumento nelle ultime 24 ore: progetto, eventi, causa probabile |
| Netlify | stato dell'ultimo deploy per sito; avvisi su crediti o limiti |
| Supabase | stato dei progetti (attivo/in pausa) e avvisi critici di sicurezza/prestazioni (`get_advisors`) |
| Bitrise | build fallite nelle ultime 24 ore |
| Alpha Vantage | XAU/USD ed EUR/USD con fonte e ora (massimo 4 chiamate; nessun consiglio) |
| TranscriptFetch | saldo crediti (`get_credits`, gratuito) |
| Google Drive | destinazione del rapporto: documento «Second Brain – rapporto connettori» |

## Pronti (si attivano appena li colleghi)
| Connettore | Azione quotidiana (sola lettura) | Uso automatico nel lavoro |
|---|---|---|
| GitHub | PR aperte da più di 3 giorni, controlli CI falliti, issue nuove nei tuoi repository | revisione delle PR con gli agenti `code-reviewer` e `security-auditor` quando lo chiedi |
| Context7 | — | ogni sessione di sviluppo lo usa per la documentazione aggiornata delle librerie (vedi CLAUDE.md) |
| Vercel | stato dell'ultimo deploy per progetto | — |
| Linear | issue assegnate a te in scadenza o bloccate | — |

## Non automatizzati (solo su richiesta, perché creano o pubblicano)
Canva, Adobe, Orshot, Zapier, Cloudflare (connettore deprecato), Gmail (collegamento incompleto).

## Fuori dai connettori
- **Playwright**: è già installato negli ambienti cloud di Claude Code. Lo usa la skill `webapp-testing` per provare le app in un browser vero.
- **Skill di sviluppo** (Superpowers, webapp-testing, Supabase) e **agenti** (`code-reviewer`, `debugger`, `security-auditor`, `test-automator`): si attivano da soli nelle sessioni di Claude Code su questo repository quando il compito li richiede.
