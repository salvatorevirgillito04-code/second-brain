# Atenir – brand per il reel

Borse, borsette, berretti e sciarpotti fatti all'uncinetto. Tono: giovane, artistico, fatto a mano. I colori sono quelli di un cesto di gomitoli: l'arcobaleno completo, mai un colore solo.
I token sono in `tokens.css`. Per ricontrollare i contrasti dopo una modifica: `node contrasto.mjs`.

## Palette

| Token | Hex | Nome |
|---|---|---|
| `--at-red` | #E2434B | melograno |
| `--at-orange` | #F5892A | zucca |
| `--at-yellow` | #FBC72E | girasole |
| `--at-green` | #3DB37A | menta |
| `--at-blue` | #2E9FE0 | cielo |
| `--at-indigo` | #4B55C9 | mirtillo |
| `--at-violet` | #9254DE | lavanda |
| `--at-cream` | #FFF3E2 | lana grezza (sfondo) |
| `--at-ink` | #2A1D3A | prugna scura (testo) |
| `--at-white` | #FFFFFF | bianco |

Font: **Fredoka** per titoli e logo (600–700), **Nunito** per il testo (700, minimo 40px sul canvas).

## Logo testuale «Atenir»

- Fredoka 700, `letter-spacing: -0.01em`, ogni lettera in uno `<span>` con un colore: **A** red, **t** orange, **e** yellow, **n** green, **i** blue, **r** violet. L'indigo resta fuori: sul fondo scuro non si legge.
- **Su fondo ink** (versione principale): lettere piene, nessun contorno. Contrasto ≥ 3,4:1 per tutte le lettere.
- **Su fondo cream o chiaro**: arancio, giallo, verde e blu non bastano (1,44–2,68:1). Ogni lettera prende un contorno ink di `var(--at-stroke)` dietro al riempimento (`-webkit-text-stroke` con `paint-order: stroke fill`, oppure SVG con `stroke` e `paint-order`) e, se serve, `--at-shadow-pop`. È il contorno a dare la leggibilità.
- Le lettere si possono ruotare di ±4° e sfalsare di ±12px in verticale, come se fossero cucite una per una. Niente di più: la parola deve restare leggibile al primo sguardo.
- Dimensione minima del logo: 120px di altezza del carattere sul canvas.

## Contrasto (WCAG 2.x, misurato con `contrasto.mjs`)

Sul telefono il canvas da 1080px si vede a circa 0,36x: 40px diventano circa 14pt. Per questo vale la soglia **AA del testo normale (4,5:1)** per body e small. La soglia da 3:1 vale solo per hero e title, cioè dai 104px in su.

**Ammesse per qualsiasi testo (≥ 4,5:1)**
- ink su cream 14,36 · ink su white 15,73 · white/cream su ink 15,73 / 14,36
- ink su yellow 9,97 · ink su orange 6,36 · ink su green 5,94 · ink su blue 5,36
- white su indigo 6,10 · cream su indigo 5,57 · white su violet 4,62

**Ammesse solo per hero e title (3:1–4,5:1)**
- white su red 4,09 · ink su red 3,85 · cream su red 3,73
- cream su violet 4,22 · ink su violet 3,40

**Vietate**
- white o cream su orange (2,47 / 2,26), green (2,65 / 2,42), blue (2,94 / 2,68), yellow (1,58 / 1,44)
- ink su indigo (2,58)
- testo colorato arcobaleno su cream senza contorno ink (vale per il logo e per qualsiasi parola)

Regola veloce: **sui colori caldi e chiari (orange, yellow, green, blue) si scrive in ink; su indigo e violet si scrive in bianco; il red si usa solo per scritte grandi.**

## Motivo grafico: punto uncinetto e filo

- **Filo**: tratto SVG `stroke-linecap: round`, spessore `--at-stroke` (12px), un colore dell'arcobaleno per volta. Curve morbide (Bézier), mai angoli vivi. Nel reel il filo "si srotola" animando `stroke-dashoffset`, e collega una scena all'altra.
- **Catenella** (punto base): fila di ovali o anelli pieni, oppure un tratto `--at-stroke-thin` con `stroke-dasharray: var(--at-stitch-dash) var(--at-stitch-gap)` e capi tondi. Si usa per bordi, sottolineature e cornici dei riquadri.
- **Granny square**: quadrati concentrici a strisce arcobaleno, angoli arrotondati. Si usano come badge o come transizione a pieno schermo.
- **Gomitoli e blob**: forme con `--at-radius-blob` come sfondo dietro alle foto dei prodotti, con un leggero dondolio (±2°, `--at-ease-out`).
- Le strisce arcobaleno vanno sempre in ordine: red → violet.

## Da evitare

- Testo, logo o call to action fuori dalle zone sicure: 220px in alto, 380px in basso, 64px ai lati.
- Testo sotto i 40px, testi in Fredoka sotto i 54px, paragrafi più lunghi di 2 righe.
- Bianco su colori chiari, nero puro (#000) e grigi freddi: le ombre si fanno in tinta ink.
- Gradienti arcobaleno sotto il testo: il contrasto cambia a ogni lettera. Il testo va su un colore pieno o su un riquadro ink o cream.
- Neon, glow, effetti metallici e 3D lucido: non c'entrano con un prodotto fatto a mano.
- Più di 3 colori dell'arcobaleno pieni nella stessa scena, se non nel logo o nel filo.
- Font caricati dalla rete: il render è offline. Si usano solo i file in `fonts/`.
