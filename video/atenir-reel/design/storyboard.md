# Atenir – storyboard del reel «Un filo, mille colori»

Versione 1 – 15/11/2026. Documento di progetto: descrive tutto quello che serve per costruire il reel in HTML/CSS/SVG e renderizzarlo con Playwright, senza ulteriori domande.

---

## 1. Obiettivo, pubblico, formato

| Voce | Valore |
|---|---|
| Obiettivo | Far conoscere Atenir e le sue 4 categorie (borse, borsette, berretti, sciarpotti) e portare le persone al profilo / link in bio. Obiettivo secondario: commenti («Qual è il tuo colore?»). |
| Messaggio chiave | Uncinetto colorato, fatto a mano, ogni pezzo è unico. |
| Pubblico | 18–35 anni, Italia; persone attente a moda indipendente, artigianato, colore; acquistano anche come regalo. Guardano con l'audio spesso spento: **il messaggio deve reggersi solo sui testi a schermo**. |
| Tono | Giovanile, artistico, allegro, mai «da catalogo». |
| Formato | MP4 H.264, 1080 × 1920 (9:16), 30 fps, `yuv420p`. |
| Durata totale | **19,0 s = 570 fotogrammi** (fotogrammi 0–569). |
| Audio nel file | **Nessuna traccia audio.** La musica si aggiunge nell'app Instagram (vedi § 7). |
| Lingua | Italiano. |

Struttura (schema da `analizza-reel`): aggancio (0–3 s) → contenuto, una categoria per scena (3–13 s) → prova / valore (13–15,5 s) → invito all'azione (15,5–19 s).

---

## 2. Canvas, zone sicure, regole comuni

### 2.1 Canvas e zone sicure

```
x: 0 ───────────────────────────── 1080
y=0     ┌──────────────────────────────┐
        │ zona UI Instagram (in alto)  │  0–220  → solo sfondo/decorazioni
y=220   ├──┬────────────────────────┬──┤  --at-safe-top
        │  │                        │  │
        │64│   AREA SICURA          │64│  x 64–1016 (larghezza 952)
        │  │   y 220–1540           │  │  y 220–1540 (altezza 1320)
        │  │   centro: (540, 880)   │  │
y=1540  ├──┴────────────────────────┴──┤  1920 − --at-safe-bottom
        │ didascalia, pulsanti IG      │  1540–1920 → solo sfondo
y=1920  └──────────────────────────────┘
```

- **Testi, prodotti, handle e CTA** stanno SEMPRE dentro x 64–1016, y 220–1540. Il lato destro (x > 900, y > 1100) è coperto dalle icone like/commenti: lì niente testo.
- Solo sfondi, fasce del filo e decorazioni possono uscire dall'area sicura.
- In CSS: `padding: var(--at-safe-top) var(--at-safe-side) var(--at-safe-bottom)` sul contenitore `.at-safe` di ogni scena.

### 2.2 Struttura HTML consigliata

```html
<main id="reel" style="width:1080px;height:1920px;position:relative;overflow:hidden">
  <section class="at-scena" id="s1-aggancio">…</section>
  <section class="at-scena" id="s2-borse">…</section>
  … (s3-borsette, s4-berretti, s5-sciarpotti, s6-valore, s7-cta)
  <div id="at-filo-wipe">…</div>   <!-- transizione condivisa -->
</main>
```

Ogni `.at-scena` è `position:absolute; inset:0`. La visibilità è governata dalla timeline (§ 2.5), non da `display`.

### 2.3 Tipografia (token)

| Ruolo | Token | Peso / note |
|---|---|---|
| Logo «Atenir», «Fatto a mano», titoli di categoria | `--at-font-display` + `--at-fs-hero` (logo) / `--at-fs-title` (categorie) | interlinea 1.0–1.1 |
| Sottotitoli | `--at-font-body` + `--at-fs-body` | peso 600–700, interlinea 1.2 |
| Contatore, note piccole | `--at-font-body` + `--at-fs-small` | peso 700, maiuscolo, spaziatura 0.06em |

Requisito minimo indipendente dai valori dei token: nessun testo sotto **44 px** di altezza del corpo a 1080 px di larghezza; righe ≤ 6 parole; testo centrato, `text-wrap: balance`.

### 2.4 Colori: regole di contrasto

- Testo su sfondo chiaro (`--at-cream`, `--at-white`, `--at-yellow`, `--at-orange`, `--at-green`): **sempre `--at-ink`**.
- Testo su sfondo scuro (`--at-ink`, `--at-indigo`, `--at-violet`): `--at-white` o `--at-cream`.
- Testo su `--at-red` o `--at-blue`: solo dentro una «pastiglia» (pill) `--at-cream` con testo `--at-ink`.
- Il testo non va mai sopra la texture a punti o sopra un prodotto: sempre su colore pieno.
- Quando i token saranno definitivi, verifica ogni coppia testo/sfondo: **≥ 4.5:1** (anche per i titoli grandi, per sicurezza su schermi luminosi). Se una coppia non passa, usa la pill.

### 2.5 Motore di animazione (deterministico)

Il rendering con Playwright cattura fotogramma per fotogramma, quindi le animazioni devono dipendere dal tempo `t`, non dall'orologio reale.

- Definisci tutte le animazioni con Web Animations API o CSS `@keyframes`, create in pausa.
- Esponi `window.atSeek(t)` (t in secondi): `document.getAnimations().forEach(a => { a.pause(); a.currentTime = t * 1000; })`; ogni animazione ha `delay` = istante di inizio indicato in tabella e `fill: 'both'`.
- Script di cattura: per `f` da 0 a 569 → `await page.evaluate(t => atSeek(t), f/30)` → `page.screenshot({ path: frames/%04d.png, clip: 0,0,1080,1920 })`. Viewport 1080×1920, `deviceScaleFactor: 1`. Attendi `document.fonts.ready` prima del primo fotogramma.
- Codifica: `ffmpeg -framerate 30 -i frames/%04d.png -c:v libx264 -pix_fmt yuv420p -crf 18 -movflags +faststart -an atenir-reel.mp4`.

### 2.6 Curve (easing) usate nel documento

| Nome | cubic-bezier | Uso |
|---|---|---|
| `out` | `cubic-bezier(0.33, 1, 0.68, 1)` | entrate di testo, scivolamenti |
| `back` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | comparsa «a molla» dei prodotti, timbri |
| `inout` | `cubic-bezier(0.65, 0, 0.35, 1)` | transizione filo, disegno del filo |
| `in` | `cubic-bezier(0.32, 0, 0.67, 0)` | uscite (più brevi delle entrate) |
| `sine` | `cubic-bezier(0.37, 0, 0.63, 1)` | oscillazioni continue (avanti-indietro, `alternate`) |

### 2.7 Componenti ricorrenti

**Entrata testo standard (`txt-in`)**: da `opacity 0; translateY(40px)` a `opacity 1; translateY(0)`, 0,3 s, `out`.
**Uscita testo standard (`txt-out`)**: a `opacity 0; translateY(-24px)`, 0,2 s, `in`.
**Entrata prodotto (`prod-in`)**: da `scale(0.6) rotate(-8deg); opacity 0` a `scale(1) rotate(0)`, 0,5 s, `back`; `transform-origin: 50% 85%`.
**Ondeggio prodotto (`prod-sway`)**: `rotate(-2deg)` ↔ `rotate(2deg)`, periodo 1,6 s, `sine`, `alternate infinite`, parte quando finisce `prod-in`.

**Contatore categorie**: 4 pallini centrati, cerchi Ø 20 px, distanza 36 px tra i centri, a y = 268 (centri x = 486, 522, 558, 594). Inattivi: `--at-ink` al 25 % di opacità; attivo: Ø 28 px, colore della scena (vedi tabella), con bordo `--at-ink` 3 px. Visibile solo nelle scene 2–5. A destra dei pallini nessun testo.

**Transizione «filo che scorre» (`#at-filo-wipe`)**, durata 0,5 s, `inout`:
- Una fascia verticale alta 2200 px (y −140…2060) e larga 280 px, composta da 7 strisce verticali da 40 px nell'ordine `--at-red, --at-orange, --at-yellow, --at-green, --at-blue, --at-indigo, --at-violet`. Bordi arrotondati 140 px (sembra un nastro di filo). Texture a punti sopra (§ 4.1) al 100 %.
- Si muove con `translateX` da x = −300 (bordo sinistro) a x = 1100.
- La scena entrante sta sopra quella uscente con `clip-path: inset(0 calc(1080px - X) 0 0)` dove X = bordo sinistro della fascia + 140 px (metà fascia): la nuova scena compare «dietro» il filo, da sinistra a destra.
- La scena uscente fa `txt-out` sui testi nei 0,2 s prima dell'inizio della transizione.
- Tra la fine di una transizione e l'inizio della successiva passano almeno 2 s (vedi accessibilità).

---

## 3. Tabella delle scene

Tempi in secondi; fotogramma = t × 30. «Transizione» indica come si passa alla scena successiva; il suo intervallo è a cavallo del taglio.

| # | Inizio–fine | Fotogrammi | Sfondo | Testo a schermo (esatto) | Transizione in uscita |
|---|---|---|---|---|---|
| 1 | 0,0–3,0 | 0–89 | `--at-cream` | «Atenir» (logo) · «Un filo. Mille colori.» | Filo che scorre 2,75–3,25 |
| 2 | 3,0–5,5 | 90–164 | `--at-yellow` | «Borse» · «Capienti, morbide, tue.» | Filo che scorre 5,25–5,75 |
| 3 | 5,5–8,0 | 165–239 | `--at-green` | «Borsette» · «Piccole, piene di carattere.» | Filo che scorre 7,75–8,25 |
| 4 | 8,0–10,5 | 240–314 | `--at-orange` | «Berretti» · «Caldi, con il pompon.» | Filo che scorre 10,25–10,75 |
| 5 | 10,5–13,0 | 315–389 | `--at-cream` | «Sciarpotti» · «Da avvolgere. Da sfoggiare.» | Filo che scorre 12,75–13,25 |
| 6 | 13,0–15,5 | 390–464 | `--at-indigo` | «Fatto a mano» · «Pezzo unico» · timbro «1 su 1» | Filo che scorre 15,25–15,75 |
| 7 | 15,5–19,0 | 465–569 | `--at-cream` | «Atenir» · «Scegli il tuo colore» · «@atenir» · «Link in bio» | Fine (ultimo fotogramma fermo) |

Durata in cui ogni testo resta **completamente visibile** (dopo l'entrata, prima dell'uscita): tutte ≥ 1,5 s, vedi dettagli.

> Nota sui colori di sfondo delle scene 2–5: se i token definitivi rendono `--at-yellow` / `--at-green` / `--at-orange` troppo saturi dietro al prodotto, usa `--at-cream` come sfondo e il colore della scena come grande «macchia» dietro al prodotto (vedi `--at-radius-blob`). Le posizioni non cambiano.

---

### Scena 1 – Aggancio (0,0–3,0 s): il filo che scrive «Atenir»

**Idea**: un gomitolo arcobaleno rotola in campo e il suo filo, srotolandosi, scrive il nome del negozio. Movimento forte già al fotogramma 0 (mai un fotogramma vuoto).

**Layout (px)**
| Elemento | Posizione | Dimensione |
|---|---|---|
| Gomitolo | centro (230, 1360) a fine entrata | Ø 200 |
| Filo gomitolo → logo | path da (300, 1320) con due anse fino all'attacco della «A» a (170, 820) | tratto 18 px |
| Logo «Atenir» | centrato, baseline y = 880, larghezza max 880 (x 100–980) | `--at-fs-hero` |
| Tagline «Un filo. Mille colori.» | centrata, y 1000–1120 (una riga; se non entra: «Un filo.» / «Mille colori.» su due righe y 990–1190) | `--at-fs-title`, `--at-ink` |
| Coriandoli-punto | 10 piccole «V» di punto (24×20) sparse in x 80–1000, y 260–620 e 1200–1500, colori dell'arcobaleno, opacità 0,7 | 24×20 |

**Gomitolo (SVG)**: cerchio Ø 200 `--at-violet` con 5 archi interni (spessore 14 px, colori `--at-red, --at-orange, --at-yellow, --at-green, --at-blue`) che seguono la curvatura (archi ellittici a 0°, 35°, 70°, 110°, 150°), contorno `--at-ink` larghezza `--at-stroke`, texture a punti.

**Filo**: un unico `<path>` con `stroke="url(#at-arcobaleno)"`, dove `#at-arcobaleno` è un `linearGradient` orizzontale (`gradientUnits="userSpaceOnUse"`, x1 = 100, x2 = 980) con 7 stop equidistanti red→violet. `stroke-linecap: round`, `fill: none`, `pathLength="1"`.

**Logo**: `<text>` SVG in `--at-font-display`, `fill` = stesso gradiente arcobaleno, `stroke: var(--at-ink)`, `stroke-width: var(--at-stroke)`, `paint-order: stroke`.

**Animazioni**
| t (s) | Elemento | Animazione | Durata | Easing |
|---|---|---|---|---|
| 0,00 | Gomitolo | entra da (−120, 1460) a (230, 1360) rotolando: `translate` + `rotate(−360° → 0°)` | 0,6 | `out` |
| 0,00 | Coriandoli | `scale 0 → 1`, sfalsati di 0,04 s ciascuno | 0,3 cad. | `back` |
| 0,15 | Filo | `stroke-dashoffset 1 → 0` (`stroke-dasharray: 1`) | 0,6 | `inout` |
| 0,15–3,0 | Gomitolo | rotazione continua lenta (−90°/s) mentre «perde filo»; scala 1 → 0,85 entro 1,4 s | — | lineare |
| 0,55 | Logo, contorno | `stroke-dasharray: 3000; stroke-dashoffset 3000 → 0` (fill-opacity 0) | 0,8 | `inout` |
| 1,10 | Logo, riempimento | `fill-opacity 0 → 1` | 0,3 | `out` |
| 1,35 | Logo | «rimbalzo»: `scale 1 → 1.06 → 1` | 0,35 | `back` |
| 0,90 | Tagline | `txt-in` (piena a 1,20) | 0,3 | `out` |
| 2,75 | Logo, tagline | nessuna uscita: vengono coperti dalla fascia della transizione | — | — |

Tagline completamente visibile 1,20–2,75 s = **1,55 s**; logo leggibile da 1,40 s.

Perché ferma lo scorrimento: movimento dal primo fotogramma, colore saturo su fondo chiaro, curiosità («cosa sta scrivendo il filo?»), nome del brand leggibile entro 1,5 s.

---

### Scene 2–5 – Categorie (struttura comune)

**Layout comune (px)**
| Elemento | Posizione |
|---|---|
| Contatore (4 pallini) | y = 268, centrato (§ 2.7) |
| «Macchia» dietro al prodotto | forma morbida 820×760 con `border-radius: var(--at-radius-blob)`, centro (540, 840), colore `--at-cream` (scene 2–4) o `--at-yellow` (scena 5), opacità 1 |
| Slot prodotto `.at-prodotto` | box 720×720, x 180–900, y 480–1200, `data-slot="borsa|borsetta|berretto|sciarpotto"` |
| Titolo categoria | centrato, box y 1240–1380, `--at-font-display`, `--at-fs-title`, `--at-ink` |
| Sottotitolo | centrato, box y 1400–1500, `--at-font-body`, `--at-fs-body`, `--at-ink` |

**Tempi comuni** (relativi all'inizio scena `T`):
| t | Elemento | Animazione | Durata | Easing |
|---|---|---|---|---|
| T+0,00 | Macchia | `scale 0.85 → 1` + `rotate(−4° → 0°)` | 0,5 | `out` |
| T+0,05 | Prodotto | `prod-in` | 0,5 | `back` |
| T+0,55 | Prodotto | `prod-sway` fino alla fine scena + animazione di dettaglio (vedi ogni scena) | — | `sine` |
| T+0,15 | Titolo | `txt-in` (pieno a T+0,45) | 0,3 | `out` |
| T+0,25 | Sottotitolo | `txt-in` (pieno a T+0,55) | 0,3 | `out` |
| T+0,00 | Contatore | il pallino attivo passa al successivo: `scale 0.7 → 1` | 0,3 | `back` |
| T+2,05 | Titolo e sottotitolo | `txt-out` | 0,2 | `in` |
| T+2,25 | — | transizione filo (fino a T+2,75, cioè 0,25 s nella scena dopo) | 0,5 | `inout` |

Visibilità piena: titolo T+0,45 → T+2,05 = **1,6 s**; sottotitolo T+0,55 → T+2,05 = **1,5 s**.

Nota: la scena entrante appare sotto la fascia già a T−0,25; i suoi elementi però partono a T (la macchia e il prodotto entrano mentre il filo finisce di passare).

### Sostituzione con foto vere (vale per tutte le categorie)

- Ogni prodotto vive dentro `<figure class="at-prodotto" data-slot="…">` 720×720. Ora contiene l'SVG inline (serve inline per animare pompon e frange).
- Con le foto: sostituisci il contenuto con `<img src="assets/foto/<slot>.webp" alt="" width="720" height="720" style="object-fit:contain">`. Foto scontornata (PNG/WebP con trasparenza), 1440×1440, prodotto centrato che occupa ~80 % del lato, base del prodotto a ~85 % dell'altezza (coerente con `transform-origin: 50% 85%`).
- `prod-in` e `prod-sway` sono sul `<figure>`, quindi continuano a funzionare; le animazioni di dettaglio (pompon, frange, manici) hanno classe `.at-dettaglio` e spariscono semplicemente con l'SVG.
- Tieni un elenco degli slot in `assets/prodotti.json`: `{ "borsa": "svg", "borsetta": "svg", … }` → valore `"foto"` per passare all'immagine. Nessun'altra modifica alla timeline.

### 4.1 Texture «punto uncinetto» (comune a tutti gli SVG)

```svg
<pattern id="at-punto" width="24" height="20" patternUnits="userSpaceOnUse">
  <ellipse cx="7"  cy="10" rx="4" ry="8" transform="rotate(-25 7 10)"
           fill="none" stroke="var(--at-ink)" stroke-opacity="0.18" stroke-width="2"/>
  <ellipse cx="17" cy="10" rx="4" ry="8" transform="rotate(25 17 10)"
           fill="none" stroke="var(--at-ink)" stroke-opacity="0.18" stroke-width="2"/>
</pattern>
```

Uso: ogni forma piena è disegnata due volte, prima col colore (`style="fill:var(--at-…)"`), poi la stessa forma con `fill="url(#at-punto)"` sopra. Per le maglie a coste (berretto) usa invece linee verticali (vedi scena 4). Contorno di tutte le forme: `stroke: var(--at-ink)`, `stroke-width: var(--at-stroke)`, `stroke-linejoin: round`. Le coordinate sotto sono nel `viewBox="0 0 720 720"`.

---

### Scena 2 – Borse (3,0–5,5 s) · pallino 1 attivo, colore `--at-blue`

Sfondo `--at-yellow`, macchia `--at-cream`.
Testo: titolo **«Borse»**, sottotitolo **«Capienti, morbide, tue.»**

**Illustrazione: borsa a sacca (tote)**
- Corpo: trapezio con angoli bassi arrotondati, `M150 300 H570 L540 640 Q540 665 515 665 H205 Q180 665 180 640 Z`.
- Tre fasce orizzontali dentro il corpo (usa `clipPath` = corpo): y 300–420 `--at-blue`, 420–540 `--at-green`, 540–665 `--at-yellow`. Texture a punti sopra.
- Bordo superiore: rettangolo 440×36 a (140, 284), raggio 18, `--at-red`, con texture.
- Manici: due archi spessi, tratto 34 px, `stroke-linecap: round`, `fill: none`:
  - posteriore `M230 300 C230 110 490 110 490 300`, colore `--at-indigo`;
  - anteriore `M260 300 C260 150 460 150 460 300`, colore `--at-orange`.
- Dettaglio: una nappina (cerchietto Ø 28 `--at-violet` + 5 trattini da 40 px che scendono) appesa al manico anteriore in (460, 300).
- Animazione di dettaglio: il manico anteriore «si solleva» `translateY(0 → −10px)` ↔ ritorno, periodo 1,6 s, `sine`; la nappina ruota ±10° attorno al punto di aggancio, periodo 0,8 s, `sine`.

---

### Scena 3 – Borsette (5,5–8,0 s) · pallino 2 attivo, colore `--at-violet`

Sfondo `--at-green`, macchia `--at-cream`.
Testo: titolo **«Borsette»**, sottotitolo **«Piccole, piene di carattere.»**

**Illustrazione: borsetta a tracolla fatta di «granny square»**
- Corpo: rettangolo 420×300 a (150, 340), raggio 28.
- Dentro: 3 × 2 quadrati granny da 140×150 (con `clipPath` = corpo). Ogni quadrato = 3 quadrati concentrici (lati 140/96/52, raggio 10), colori che ruotano per quadrato:
  1. red / yellow / blue, 2. orange / green / violet, 3. yellow / indigo / red, 4. green / red / orange, 5. blue / orange / yellow, 6. violet / yellow / green.
  Fughe tra i quadrati: linee `--at-cream` 6 px.
- Patta: mezza ellisse che scende dal bordo superiore del corpo e lo copre fino a y = 450: `M150 340 H570 A210 110 0 0 1 150 340 Z`, colore `--at-red`, texture.
- Bottone: cerchio Ø 40 `--at-yellow` in (360, 440), 4 forellini Ø 6 `--at-ink`.
- Tracolla: `M170 360 C170 80 550 80 550 360`, tratto 16 px `--at-orange`, linecap round, con trattini `--at-ink` al 30 % (`stroke-dasharray: 2 18`) sovrapposti per suggerire la catenella.
- Animazione di dettaglio: la patta si solleva di poco e si richiude: `scaleY(1 → 0.9 → 1)` con `transform-origin` al bordo superiore, 0,6 s, `out`, una volta a T+0,6; poi il bottone fa `scale 1 → 1.15 → 1` a T+1,2 (0,3 s, `back`).

---

### Scena 4 – Berretti (8,0–10,5 s) · pallino 3 attivo, colore `--at-red`

Sfondo `--at-orange`, macchia `--at-cream`.
Testo: titolo **«Berretti»**, sottotitolo **«Caldi, con il pompon.»**

**Illustrazione: berretto a cupola con risvolto a coste e pompon**
- Cupola: `M130 520 C130 250 590 250 590 520 Z`, colore `--at-red`, texture a punti; sopra 3 righe ondulate orizzontali (tratto 10 px, `--at-yellow`, `--at-green`, `--at-blue`) alle quote y ≈ 360, 420, 480, che seguono la cupola (clip sulla cupola).
- Risvolto: rettangolo 500×120 a (110, 510), raggio 30, `--at-violet`. Coste: linee verticali `--at-ink` opacità 0,2, tratto 4 px, ogni 24 px da x = 134 a 586.
- Pompon: centro (360, 210), raggio 80, colore `--at-yellow`. Forma «soffice»: cerchio + 20 cerchietti Ø 34 distribuiti sul bordo (ogni 18°) dello stesso colore, contorno solo sull'unione (disegna prima tutti i cerchi con `stroke` e poi di nuovo tutti senza stroke sopra, così resta il contorno esterno). Sopra, 8 trattini corti (`--at-orange`, 3 px) a raggiera per il pelo.
- Animazione di dettaglio: il pompon «rimbalza»: `translateY(0 → −28px → 0)` + `scale(1, 1) → (0.92, 1.08) → (1.06, 0.94) → 1` con origine alla base del pompon, 0,7 s, `back`, ripetuto 2 volte (a T+0,6 e T+1,4).

---

### Scena 5 – Sciarpotti (10,5–13,0 s) · pallino 4 attivo, colore `--at-green`

Sfondo `--at-cream`, macchia `--at-yellow`.
Testo: titolo **«Sciarpotti»**, sottotitolo **«Da avvolgere. Da sfoggiare.»**

**Illustrazione: sciarpone a righe arcobaleno, avvolto a «S», con frange**
- Asse dello sciarpotto: `M120 160 C420 160 560 300 360 380 C160 460 300 600 600 600` (forma a S che attraversa lo slot).
- Righe longitudinali: lo stesso path disegnato 7 volte, `fill: none`, `stroke-linecap: butt`, uno sopra l'altro con spessori decrescenti e colori: 150 px `--at-red`, 128 `--at-orange`, 106 `--at-yellow`, 84 `--at-green`, 62 `--at-blue`, 40 `--at-indigo`, 18 `--at-violet` (risultato: righe simmetriche lungo tutta la sciarpa). Sotto a tutto, lo stesso path a 158 px `--at-ink` per il contorno. Texture: path a 150 px con `stroke="url(#at-punto)"`.
- Frange: a ciascuna estremità, 9 linee lunghe 70 px, tratto 10 px, linecap round, distribuite sulla larghezza 150 px, perpendicolari all'asse (all'inizio verso sinistra, alla fine verso destra), colori a rotazione dell'arcobaleno. Raggruppa ogni ciuffo in `<g class="at-dettaglio frange-a|frange-b">`.
- Animazioni di dettaglio:
  - la sciarpa «si srotola»: tutti i 9 path hanno `pathLength="1"`, `stroke-dasharray: 1`, `stroke-dashoffset 1 → 0`, 0,8 s, `inout`, da T+0,05 (sostituisce `prod-in` per questa scena; il `<figure>` fa solo `opacity 0 → 1` in 0,15 s);
  - frange: compaiono a T+0,8 (`opacity 0 → 1`, 0,15 s) poi oscillano `rotate(−6° ↔ 6°)` attorno al punto di attacco, periodo 1,2 s, `sine`.

---

### Scena 6 – Valore (13,0–15,5 s): «Fatto a mano · Pezzo unico»

Sfondo `--at-indigo` (testi `--at-white`). È la scena «prova»: rompe il ritmo cromatico chiaro e fa risaltare il messaggio.

**Layout (px)**
| Elemento | Posizione | Note |
|---|---|---|
| Uncinetto + filo | uncinetto: rettangolo arrotondato 520×22 ruotato −30°, centro (560, 470), colore `--at-cream`, punta a gancio (arco r 16) in alto a destra; filo arcobaleno (gradiente § scena 1, tratto 14) che parte dalla punta e forma una catenella di 6 punti a «V» lungo la retta y = 640, x 200–880 | box y 300–700 |
| «Fatto a mano» | centrato, box y 760–900 | `--at-font-display`, `--at-fs-title`, `--at-white` |
| «Pezzo unico» | centrato, box y 920–1060 | stesso stile, colore `--at-yellow` (verificare contrasto su indigo ≥ 4.5:1, altrimenti `--at-cream`) |
| Timbro «1 su 1» | cerchio Ø 240, centro (540, 1260), fondo `--at-yellow`, bordo tratteggiato `--at-ink` 4 px (`stroke-dasharray: 10 8`) a 10 px dal bordo, testo «1 su 1» `--at-ink`, `--at-font-display`, ~`--at-fs-body` × 1,4 | ruotato −10° |

**Animazioni**
| t (s) | Elemento | Animazione | Durata | Easing |
|---|---|---|---|---|
| 13,00 | Uncinetto | entra da `translate(160px, −120px) rotate(−20deg)` a posizione | 0,4 | `out` |
| 13,10 | Filo / catenella | `stroke-dashoffset 1 → 0` | 0,9 | `inout` |
| 13,10–15,2 | Uncinetto | piccolo movimento «a lavorare»: `translate(0,0) ↔ (−12px, 8px)`, periodo 0,45 s (≈ 2,2 cicli/s, movimento, non lampeggio) | — | `sine` |
| 13,15 | «Fatto a mano» | `txt-in` (pieno 13,45) | 0,3 | `out` |
| 13,30 | «Pezzo unico» | `txt-in` (pieno 13,60) | 0,3 | `out` |
| 13,90 | Timbro | `scale 1.6 → 1` + `rotate(−30° → −10°)`, `opacity 0 → 1` | 0,35 | `back` |
| 15,10 | Tutti i testi e il timbro | `txt-out` | 0,15 | `in` |

Visibilità piena: «Fatto a mano» 13,45–15,10 = 1,65 s; «Pezzo unico» 13,60–15,10 = **1,5 s**; timbro 14,25–15,10.

---

### Scena 7 – Invito all'azione (15,5–19,0 s)

Sfondo `--at-cream`. Ultimo fotogramma (569) deve funzionare anche come immagine ferma.

**Layout (px)**
| Elemento | Posizione | Stile |
|---|---|---|
| Arco arcobaleno | 7 semicirconferenze concentriche, centro (540, 700), raggi 400, 360, 320, 280, 240, 200, 160, tratto 36, linecap round, colori red→violet dall'esterno; texture a punti | occupa y 300–700, x 140–940 |
| Logo «Atenir» | centrato, baseline y = 820 | come scena 1 (gradiente + contorno), `--at-fs-hero` × 0,8 |
| «Scegli il tuo colore» | centrato, box y 880–990 | `--at-font-body`, `--at-fs-body`, peso 700, `--at-ink` |
| «@atenir» | centrato, box y 1030–1170 | `--at-font-display`, `--at-fs-title`, `--at-ink` |
| Pill «Link in bio» | 560×120, centro (540, 1300), raggio 60, fondo `--at-ink`, testo `--at-white` `--at-font-body` `--at-fs-body` peso 800; a sinistra del testo una freccia verso l'alto (SVG, 40×40, tratto 6 px, `--at-yellow`) | y 1240–1360 |
| 4 mini prodotti | le 4 illustrazioni ridotte a 150×150, sulla riga y 1390–1540, centri x = 210, 410, 670, 870 (spazio centrale libero) | opzionale; se affolla, eliminali |

**Animazioni**
| t (s) | Elemento | Animazione | Durata | Easing |
|---|---|---|---|---|
| 15,50 | Arco | ogni semicerchio `stroke-dashoffset 1 → 0`, sfalsati di 0,05 s dall'esterno | 0,6 cad. | `out` |
| 15,70 | Logo | `scale 0.8 → 1`, `opacity 0 → 1` | 0,4 | `back` |
| 15,85 | «Scegli il tuo colore» | `txt-in` | 0,3 | `out` |
| 16,00 | «@atenir» | `txt-in` | 0,3 | `out` |
| 16,20 | Pill | `translateY(60px) → 0`, `opacity 0 → 1` | 0,4 | `back` |
| 16,40 | Mini prodotti | `prod-in` sfalsati di 0,08 s | 0,4 cad. | `back` |
| 17,00–19,0 | Pill | «respiro» `scale 1 ↔ 1.04`, periodo 1,2 s | — | `sine` |
| 17,00–19,0 | Freccia | `translateY(0 ↔ −8px)`, periodo 1,2 s | — | `sine` |

Visibilità: tutti i testi pieni da ≤ 16,6 s a 19,0 s = **≥ 2,4 s**. Nessuna uscita: il video finisce sul CTA (Instagram riparte in loop, e la scena 1 è chiara come la 7: il loop è morbido).

`@atenir` è un **segnaposto**: handle da confermare. Mettilo in un'unica variabile (`const HANDLE = '@atenir'`) usata sia nel testo sia nell'eventuale `alt`.

---

## 5. Riepilogo ritmo

- 7 scene, 6 transizioni, durata media scena 2,7 s (scene prodotto 2,5 s): ritmo veloce ma leggibile.
- Tagli allineabili alla musica: scene 2–5 da 2,5 s = 4 battute a **96 BPM** (1 battito = 0,625 s).
- Il colore di fondo cambia a ogni scena (giallo, verde, arancione, crema, indaco, crema): l'arcobaleno «scorre» anche nella struttura.

## 6. Didascalia del post e hashtag

**Didascalia** (incollare così):

```
Un filo, mille colori.

Borse, borsette, berretti e sciarpotti all'uncinetto, fatti a mano uno per uno: ogni pezzo è unico, come chi lo indossa.

Qual è il tuo colore? Scrivilo nei commenti.
Scopri la collezione: link in bio.

#uncinetto #fattoamano #pezzounico #artigianatoitaliano #borseuncinetto #berrettouncinetto #sciarpauncinetto
```

(7 hashtag, tutti in italiano. Sostituire «link in bio» se si usa il pulsante prodotto di Instagram Shopping.)

**Testo alternativo** (Impostazioni avanzate → Accessibilità → testo alternativo):
«Animazione colorata: un filo arcobaleno scrive Atenir, poi compaiono illustrazioni di una borsa, una borsetta, un berretto con pompon e uno sciarpotto all'uncinetto. Testo finale: fatto a mano, pezzo unico, @atenir, link in bio.»

**Copertina**: usa il fotogramma a **1,8 s** (logo pieno + tagline) oppure carica come copertina un PNG catturato a t = 1,8 s con la sola area 1080×1350 centrale leggibile (y 285–1635: logo e tagline ci stanno).

## 7. Suggerimento audio

- Nessun brano nel file: il video si esporta senza audio (`-an`) e la musica si sceglie **nella libreria audio di Instagram** al momento della pubblicazione (così i diritti sono gestiti da Instagram; con un account aziendale usare la sezione audio senza diritti / «royalty free» disponibile per i profili business).
- Carattere: acustico-pop allegro (ukulele, glockenspiel, battito di mani), senza voce o con voce leggera, 90–100 BPM, ideale **96 BPM**.
- Parole da cercare nella libreria: «happy ukulele», «acoustic happy», «cute», «handmade», «cozy».
- Allineamento: nell'editor di Instagram sposta l'inizio del brano in modo che un tempo forte cada a **3,0 s** (primo taglio); a 96 BPM i tagli 5,5 / 8,0 / 10,5 / 13,0 cadono poi sul tempo.
- Volume: il video non ha parlato, quindi la musica può restare al 100 %.

## 8. Accessibilità

- **Tempo di lettura**: ogni testo resta completamente visibile **≥ 1,5 s** (valori verificati nelle tabelle: aggancio 1,55 s, categorie 1,5–1,6 s, valore 1,5–1,6 s, CTA ≥ 2,4 s). Se si cambia un testo con più parole, allunga la scena, non accorciare la lettura.
- **Contrasto**: testo/sfondo ≥ 4.5:1 con i valori definitivi dei token (regole § 2.4). Testo sempre su colore pieno, mai su texture, prodotti o gradienti; il logo a gradiente ha il contorno `--at-ink` e non è l'unico portatore del nome (c'è anche «@atenir» in tinta unita).
- **Niente lampeggi**: nessun elemento cambia luminosità più di 3 volte al secondo. Le grandi variazioni di luminosità sono solo le 6 transizioni, distanziate di ≥ 2,0 s, ciascuna una sola volta e graduale (0,5 s). Le oscillazioni continue sono movimenti, non cambi di colore, e restano ≤ 2,2 cicli/s. Nessun effetto strobo, nessun flash bianco.
- **Movimento**: nessuno scorrimento di tutto lo schermo oltre alla fascia del filo; niente zoom violenti (scala massima 1,6 solo sul timbro, piccolo).
- **Zone sicure**: testi e CTA dentro y 220–1540, x 64–1016, lontani dalle icone di Instagram.
- **Senza audio**: il messaggio è comprensibile solo dai testi; nessuna informazione affidata alla musica.
- **Testo alternativo** del post compilato (§ 6).
- **Colore non unico portatore di significato**: ogni categoria ha il nome scritto, non solo un colore.

## 9. Lista di controllo per lo sviluppatore

1. Token CSS caricati (`--at-*`), font attesi con `document.fonts.ready`.
2. Sette `<section class="at-scena">` + `#at-filo-wipe`, timeline con `atSeek(t)`.
3. Verifica con Playwright alcuni fotogrammi chiave: 0 (non vuoto), 54 (t = 1,8, copertina), 100, 175, 250, 325, 410, 569; controlla che nessun testo esca dall'area sicura (bounding box di ogni elemento con classe `.at-testo` dentro x 64–1016, y 220–1540).
4. Contrasto di ogni coppia testo/sfondo calcolato coi token reali.
5. Rendering 570 PNG → MP4 senza audio, controlla durata 19,00 s e 30 fps con `ffprobe`.
6. Handle `@atenir` ancora da confermare prima della pubblicazione.
