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
| skills/sound-effects, text-to-speech, setup-api-key (aggiunta una nota: niente `npx … onboard`, chiave solo come segreto di rete) | github.com/elevenlabs/skills | 1d84076 | MIT (ElevenLabs) |
| skills/music-gen (da music-gen-skill: SKILL.md, scripts/render.sh, scripts/melody_example.py) | github.com/sirruf/music-gen-skill | a025267 | MIT |
| skills/game-audio | github.com/sickn33/antigravity-awesome-skills, skills/game-development/game-audio | 560b762c | MIT (codice), CC BY 4.0 (contenuti) |
| skills/sound-engineer (tolta la riga `allowed-tools` con `npm:*` e connettori non presenti; tolto `.claude-plugin`) | github.com/curiositech/some_claude_skills | d47e2e5 | MIT |
| skills/media-utils (script Python che chiamano solo ffmpeg/ffprobe, senza shell) | github.com/michaelboeding/skills | 9e7cf76 | MIT |
| skills/ffmpeg-audio-processing | github.com/JosiahSiegel/claude-plugin-marketplace, plugins/ffmpeg-core | 5a1b112 | MIT |
| skills/team-audio (adattata: tolti `allowed-tools`, modello fisso e la Phase 0 che eseguiva `yaml-helper.sh`; configurazione fissa, documenti in `docs/audio/`), agents/audio-director, sound-designer, technical-artist, gameplay-programmer | github.com/Donchitos/Claude-Code-Game-Studios | abc0de7 | MIT |

Revisione del 14/11/2026 (licenze MIT e Apache 2.0): gli script eseguibili non fanno richieste di rete né eseguono comandi di sistema (solo csv, json e regex in locale); le istruzioni non chiedono credenziali né installazioni. Per aggiornarli: ripetere la revisione sul nuovo commit prima di copiare.

Note di revisione aggiuntive: il server di brainstorming di Superpowers ascolta solo su 127.0.0.1 e apre il browser solo su richiesta; `webapp-testing/scripts/with_server.py` avvia il comando del server indicato dall'utente (shell): usarlo solo con comandi del progetto.

Revisione del 15/11/2026 (skill audio, licenze MIT e CC BY 4.0): nessuno script fa richieste di rete; `media-utils` esegue solo `ffmpeg`/`ffprobe` con argomenti in lista (niente shell), `music-gen/scripts/render.sh` usa solo fluidsynth/timidity/sox/ffmpeg locali. Le skill ElevenLabs chiamano l'API di ElevenLabs (rete, crediti del piano): la chiave non va mai nel repository. Strumenti da installare solo su richiesta: ffmpeg, fluidsynth, `pip install mido` (music-gen), `pip install markdown weasyprint` (solo per `report_to_pdf.py`).

Dal 15/11/2026 le stesse skill audio e i 4 agenti di team-audio vengono installati anche a livello utente (`~/.claude/skills`, `~/.claude/agents`) in ogni nuova sessione dell'ambiente cloud «Predefinito», dallo script d'avvio salvato in `automazioni/setup-ambiente.sh`. Lo script scarica gli stessi commit fissati qui sopra e applica le stesse modifiche (nota su ElevenLabs abbreviata). Se aggiorni un commit qui, aggiorna anche lo script dell'ambiente.
