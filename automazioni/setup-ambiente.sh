# Istruzioni utente per tutte le sessioni (richiesta del 15/11/2026)
mkdir -p "${HOME:-/root}/.claude"
cat > "${HOME:-/root}/.claude/CLAUDE.md" <<'REGOLE'
# Regole dell'utente (valgono in ogni sessione, repository e ramo)

Rispondi in italiano.

## Uso automatico di skill, agenti e connettori
- Usa SEMPRE e da solo le skill, gli agenti e i connettori adatti al compito,
  senza che l'utente li nomini e senza chiedere il permesso di usarli.
- Prima di rispondere controlla le skill disponibili e i connettori attivi;
  scrivi in una riga quali stai usando.
- Conferma prima solo cio' che costa denaro o crediti a pagamento,
  pubblica qualcosa o elimina qualcosa. Mai segreti in file o repository.

## Audio (giochi e video), quando le skill o i connettori ci sono
- effetti sonori: skill sound-effects (ElevenLabs), sound-engineer; Epidemic Sound
- musica e loop: skill music-gen (locale, gratis); Epidemic Sound con licenza
- voce narrante: skill text-to-speech (ElevenLabs)
- effetti sincronizzati a un video: connettore Mirelo
- pulizia della voce: connettore Adobe (media_enhance_speech)
- mix e unione con il video: media-utils; volume e formati: ffmpeg-audio-processing
- audio di un gioco: game-audio; progetto completo: team-audio
- ElevenLabs: chiave come segreto di rete (api.elevenlabs.io), mai in un file.
- Suno: non usarlo per lavori da pubblicare (cause sul copyright in corso).
REGOLE
# Skill audio per ogni sessione (richiesta del 15/11/2026): commit fissati, rivisti in second-brain/.claude/TERZE-PARTI.md
C="${HOME:-/root}/.claude"; mkdir -p "$C/skills" "$C/agents"; W="$(mktemp -d)"
prendi() { # $1 repo, $2 commit, $3.. percorsi
  local d="$W/${1//\//_}"; git init -q "$d" && cd "$d" || return 1
  git remote add o "https://github.com/$1" && git sparse-checkout set --no-cone "${@:3}" >/dev/null 2>&1
  timeout 90 git fetch -q --depth 1 --filter=blob:none o "$2" && git checkout -q FETCH_HEAD; cd - >/dev/null
}
skill() { # $1 cartella sorgente, $2 nome, $3 licenza
  [ -d "$1" ] || return 1; rm -rf "$C/skills/$2"; cp -r "$1" "$C/skills/$2"; [ -f "$3" ] && cp "$3" "$C/skills/$2/LICENSE"
}
NOTA='> **Nota (revisione del 15/11/2026):** non eseguire `npx @elevenlabs/cli onboard` e non scrivere mai la chiave in un file o repository.'
NOTA2='> La chiave e'"'"' un segreto di rete per api.elevenlabs.io (header xi-api-key); se serve ELEVENLABS_API_KEY usa un valore fittizio.'
{
E=elevenlabs/skills; prendi $E 1d84076319721b3e0b3c8189c76e91a0d859d9d4 /sound-effects /text-to-speech /setup-api-key /LICENSE
for s in sound-effects text-to-speech setup-api-key; do skill "$W/elevenlabs_skills/$s" $s "$W/elevenlabs_skills/LICENSE"
  f="$C/skills/$s/SKILL.md"; [ -f "$f" ] && awk -v a="$NOTA" -v b="$NOTA2" '{print} /^---$/ && ++n==2 {print ""; print a; print b}' "$f" > "$f.n" && mv "$f.n" "$f"; done
prendi sirruf/music-gen-skill a025267abd8b669035695f60ff22b54fc71c1362 /SKILL.md /scripts /LICENSE
mkdir -p "$W/mg" && cp -r "$W/sirruf_music-gen-skill/SKILL.md" "$W/sirruf_music-gen-skill/scripts" "$W/mg/" && skill "$W/mg" music-gen "$W/sirruf_music-gen-skill/LICENSE"
G=sickn33/antigravity-awesome-skills; prendi $G 560b762c309d6b96315855d7968727d3bca7df20 /skills/game-development/game-audio /LICENSE
skill "$W/sickn33_antigravity-awesome-skills/skills/game-development/game-audio" game-audio "$W/sickn33_antigravity-awesome-skills/LICENSE"
prendi curiositech/some_claude_skills d47e2e5ded912f448b36da6c391be724d3e50496 /.claude/skills/sound-engineer /LICENSE
skill "$W/curiositech_some_claude_skills/.claude/skills/sound-engineer" sound-engineer "$W/curiositech_some_claude_skills/LICENSE"
rm -rf "$C/skills/sound-engineer/.claude-plugin"; sed -i '/^allowed-tools:/d' "$C/skills/sound-engineer/SKILL.md"
prendi michaelboeding/skills 9e7cf764f36cc2bfe187280dd00517d4257f7432 /skills/media-utils /LICENSE
skill "$W/michaelboeding_skills/skills/media-utils" media-utils "$W/michaelboeding_skills/LICENSE"
J=JosiahSiegel/claude-plugin-marketplace; P=/plugins/ffmpeg-core/skills/ffmpeg-audio-processing
prendi $J 5a1b1123b9e50aa9a66a61005ca6fe012cc7442d $P /LICENSE
skill "$W/JosiahSiegel_claude-plugin-marketplace$P" ffmpeg-audio-processing "$W/JosiahSiegel_claude-plugin-marketplace/LICENSE"
D=Donchitos/Claude-Code-Game-Studios; A=/.claude/agents
prendi $D abc0de79d6ceb0b5d7aa693945849b3937afbe6a /.claude/skills/team-audio /LICENSE $A/audio-director.md $A/sound-designer.md $A/technical-artist.md $A/gameplay-programmer.md
R="$W/Donchitos_Claude-Code-Game-Studios"; skill "$R/.claude/skills/team-audio" team-audio "$R/LICENSE"
f="$C/skills/team-audio/SKILL.md"; sed -i '/^allowed-tools:/d;/^model: sonnet$/d;/^!`bash/d' "$f"
sed -i 's|^## Phase 0: Resolve Config|&\n\nAdattata: niente yaml-helper; usa review_mode lean, automation collaborative, team.size small; documenti in docs/audio/.|' "$f"
for a in audio-director sound-designer technical-artist gameplay-programmer; do [ -f "$R$A/$a.md" ] && cp "$R$A/$a.md" "$C/agents/"; done
} || echo "skill audio: installazione parziale"
rm -rf "$W"; ls "$C/skills" | tr '\n' ' '; echo
