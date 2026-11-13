// Simulazione in memoria dell'API Contents di GitHub, usata SOLO dai test automatici.
// Riproduce le regole che contano per la sincronizzazione: sha per file, 409 se lo sha non è
// quello attuale, 422 se manca lo sha su un file esistente, rami, 401/0 su richiesta.
import { createHash } from "node:crypto";

export class FintoGitHub {
  constructor(owner = "utente", repo = "second-brain") {
    this.R = `/repos/${owner}/${repo}`;
    this.rami = { main: new Map([["README.md", "ciao\n"]]) };
    this.richieste = [];
    this.guasto = null; // { tipo: "rete" | "401" | "perdi_risposta", quando: (metodo, percorso) => bool, volte }
  }
  static shaBlob(testo) { const b = Buffer.from(testo, "utf8"); return createHash("sha1").update(`blob ${b.length}\0`).update(b).digest("hex"); }
  file(ramo, percorso) { return this.rami[ramo]?.get(percorso); }
  scriviDiretto(ramo, percorso, testo) { this.rami[ramo].set(percorso, testo); } // modifica fatta da un altro dispositivo / Claude Code
  eliminaDiretto(ramo, percorso) { this.rami[ramo].delete(percorso); }

  api() { return { richiesta: (m, p, c) => this.gestisci(m, p, c) }; }

  async gestisci(metodo, percorso, corpo) {
    this.richieste.push(`${metodo} ${percorso}`);
    const g = this.guasto;
    if (g && g.quando(metodo, percorso) && g.volte !== 0) {
      if (g.volte > 0) g.volte--;
      if (g.tipo === "rete") return { status: 0, corpo: null };
      if (g.tipo === "401") return { status: 401, corpo: { message: "Bad credentials" } };
      if (g.tipo === "perdi_risposta") { this.esegui(metodo, percorso, corpo); return { status: 0, corpo: null }; } // applicata ma risposta persa
    }
    return this.esegui(metodo, percorso, corpo);
  }

  esegui(metodo, percorso, corpo) {
    const R = this.R;
    const [via, query] = percorso.split("?");
    const ref = new URLSearchParams(query || "").get("ref") || "main";
    if (metodo === "GET" && via === R) return { status: 200, corpo: { default_branch: "main", permissions: { push: true } } };
    let m;
    if (metodo === "GET" && (m = via.match(/^.+\/branches\/(.+)$/))) return this.rami[m[1]] ? { status: 200, corpo: { name: m[1] } } : { status: 404, corpo: {} };
    if (metodo === "GET" && (m = via.match(/^.+\/git\/ref\/heads\/(.+)$/))) return this.rami[m[1]] ? { status: 200, corpo: { object: { sha: "c0ffee" + m[1] } } } : { status: 404, corpo: {} };
    if (metodo === "POST" && via === R + "/git/refs") {
      const nome = corpo.ref.replace("refs/heads/", "");
      if (this.rami[nome]) return { status: 422, corpo: { message: "Reference already exists" } };
      this.rami[nome] = new Map(this.rami.main); return { status: 201, corpo: {} };
    }
    if ((m = via.match(/^.+\/contents\/(.+)$/))) {
      const p = m[1];
      const ramo = metodo === "GET" ? ref : corpo.branch || "main";
      const files = this.rami[ramo]; if (!files) return { status: 404, corpo: {} };
      if (metodo === "GET") {
        if (files.has(p)) { const t = files.get(p); return { status: 200, corpo: { type: "file", sha: FintoGitHub.shaBlob(t), content: Buffer.from(t).toString("base64").replace(/(.{60})/g, "$1\n") } }; }
        const pref = p + "/"; const figli = [...files.keys()].filter((k) => k.startsWith(pref) && !k.slice(pref.length).includes("/"));
        if (!figli.length) return { status: 404, corpo: { message: "Not Found" } };
        return { status: 200, corpo: figli.map((k) => ({ type: "file", name: k.slice(pref.length), path: k, sha: FintoGitHub.shaBlob(files.get(k)) })) };
      }
      if (metodo === "PUT") {
        const esiste = files.has(p);
        if (esiste && !corpo.sha) return { status: 422, corpo: { message: "sha wasn't supplied" } };
        if (esiste && corpo.sha !== FintoGitHub.shaBlob(files.get(p))) return { status: 409, corpo: { message: "does not match" } };
        if (!esiste && corpo.sha) return { status: 409, corpo: { message: "file deleted" } };
        const t = Buffer.from(corpo.content, "base64").toString("utf8"); files.set(p, t);
        return { status: esiste ? 200 : 201, corpo: { content: { sha: FintoGitHub.shaBlob(t), path: p } } };
      }
      if (metodo === "DELETE") {
        if (!files.has(p)) return { status: 404, corpo: {} };
        if (corpo.sha !== FintoGitHub.shaBlob(files.get(p))) return { status: 409, corpo: { message: "does not match" } };
        files.delete(p); return { status: 200, corpo: {} };
      }
    }
    return { status: 404, corpo: { message: "non simulato: " + metodo + " " + percorso } };
  }
}
