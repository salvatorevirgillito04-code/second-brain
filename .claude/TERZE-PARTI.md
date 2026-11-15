# Componenti di terze parti (copiati dopo revisione, licenza MIT)

| Componente | Origine | Commit | Licenza |
|---|---|---|---|
| skills/ui-ux-pro-max (SKILL.md, data, references, scripts senza test) | github.com/nextlevelbuilder/ui-ux-pro-max-skill | 6ae86f6 | MIT (Next Level Builder), vedi LICENSE nella cartella |
| skills/impeccable (SKILL.md, reference, scripts/data; **senza** il motore binario e gli script del browser; aggiunta una nota in SKILL.md) | github.com/pbakaus/impeccable | 32f10a7 | Apache 2.0, vedi LICENSE e NOTICE.md nella cartella |
| skills/mobile-android-design, skills/accessibility-compliance | github.com/wshobson/agents, plugins/ui-design | 9c61ab2 | MIT (Seth Hobson), vedi LICENSE nelle cartelle |
| skills/brainstorming, writing-plans, executing-plans, test-driven-development, systematic-debugging, verification-before-completion, requesting-code-review, receiving-code-review, subagent-driven-development, dispatching-parallel-agents, using-git-worktrees, finishing-a-development-branch, writing-skills, using-superpowers | github.com/obra/superpowers | 22f0b46 | MIT (vedi LICENSE nelle cartelle) |
| skills/webapp-testing | github.com/anthropics/skills | 2c5958e | Apache 2.0 (LICENSE.txt nella cartella) |
| skills/supabase, skills/supabase-postgres-best-practices | github.com/supabase/agent-skills | c9be0e9 | MIT |
| agents/code-reviewer, debugger, security-auditor, test-automator (strumenti ridotti, modello ereditato) | github.com/wshobson/agents | 9c61ab2 | MIT |
| agents/ui-designer.md, agents/accessibility-expert.md, agents/design-system-architect.md | github.com/wshobson/agents, plugins/ui-design | 9c61ab2 | MIT (Seth Hobson) |

Revisione del 14/11/2026 (licenze MIT e Apache 2.0): gli script eseguibili non fanno richieste di rete né eseguono comandi di sistema (solo csv, json e regex in locale); le istruzioni non chiedono credenziali né installazioni. Per aggiornarli: ripetere la revisione sul nuovo commit prima di copiare.

Note di revisione aggiuntive: il server di brainstorming di Superpowers ascolta solo su 127.0.0.1 e apre il browser solo su richiesta; `webapp-testing/scripts/with_server.py` avvia il comando del server indicato dall'utente (shell): usarlo solo con comandi del progetto.
