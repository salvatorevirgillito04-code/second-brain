package it.secondbrain.app;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Metodi esposti all'interfaccia JavaScript come window.Android.
 * Il token GitHub non viene mai restituito a JavaScript: le richieste passano da qui,
 * solo verso api.github.com e solo per il repository configurato.
 */
public class Ponte {
    static final String OWNER = "salvatorevirgillito04-code";
    static final String REPO = "second-brain";
    static final String PREFISSO = "/repos/" + OWNER + "/" + REPO;
    static final int MAX_IMPORT = 20 * 1024 * 1024;

    private final MainActivity attivita;
    private final WebView web;
    private final Archivio archivio;
    private final Cassaforte cassaforte;
    private final ClientGitHub github;
    private final ExecutorService rete = Executors.newSingleThreadExecutor();
    private String daEsportare;
    private String messaggioEsportazione;

    Ponte(MainActivity a, WebView w) {
        attivita = a; web = w;
        archivio = new Archivio(a.getFilesDir());
        cassaforte = new Cassaforte(a);
        github = new ClientGitHub();
    }

    // ---------- archivio locale ----------
    @JavascriptInterface public String caricaDati() { return archivio.leggi(false); }
    @JavascriptInterface public String caricaDatiPrecedenti() { return archivio.leggi(true); }
    @JavascriptInterface public String salvaDati(String json) {
        try { archivio.scrivi(json); return "ok"; } catch (Exception e) { return "errore di scrittura (" + e.getClass().getSimpleName() + ")"; }
    }

    // ---------- token ----------
    @JavascriptInterface public boolean haToken() { return cassaforte.presente(); }
    @JavascriptInterface public String impostaToken(String t) {
        if (t == null) return "Token vuoto.";
        t = t.trim();
        if (!t.startsWith("github_pat_")) return "Usa un token a grana fine (inizia con github_pat_), limitato al solo repository second-brain.";
        if (t.length() < 40 || t.length() > 255 || !t.matches("[A-Za-z0-9_]+")) return "Il token non sembra completo: copialo di nuovo da GitHub.";
        try { cassaforte.salva(t); return "ok"; } catch (Exception e) { return "Impossibile salvare il token in modo cifrato (" + e.getClass().getSimpleName() + ")."; }
    }
    @JavascriptInterface public void rimuoviToken() { cassaforte.rimuovi(); }

    // ---------- rete ----------
    @JavascriptInterface public boolean retePresente() {
        ConnectivityManager cm = attivita.getSystemService(ConnectivityManager.class);
        if (cm == null) return false;
        Network n = cm.getActiveNetwork();
        NetworkCapabilities c = n == null ? null : cm.getNetworkCapabilities(n);
        return c != null && c.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
    }

    @JavascriptInterface public void github(final String id, final String metodo, final String percorso, final String corpo) {
        rete.execute(() -> {
            int stato; String risposta;
            boolean consentito = percorso != null && (percorso.equals(PREFISSO) || percorso.startsWith(PREFISSO + "/")) && !percorso.contains("..")
                    && ("GET".equals(metodo) || "PUT".equals(metodo) || "DELETE".equals(metodo) || "POST".equals(metodo));
            String token = consentito ? cassaforte.leggi() : null;
            if (!consentito) { stato = 400; risposta = "{\"message\":\"richiesta non consentita dall'app\"}"; }
            else if (token == null) { stato = 401; risposta = "{\"message\":\"token assente o non più leggibile\"}"; }
            else {
                ClientGitHub.Risposta r = github.invia(token, metodo, percorso, corpo);
                stato = r.stato; risposta = r.corpo;
            }
            final String js = "window.__risposta(" + JSONObject.quote(id) + "," + stato + "," + JSONObject.quote(risposta == null ? "" : risposta) + ")";
            web.post(() -> web.evaluateJavascript(js, null));
        });
    }

    // ---------- file (selettore di Android) ----------
    @JavascriptInterface public void esporta(String nome, String testo, String messaggioOk) {
        daEsportare = testo; messaggioEsportazione = messaggioOk;
        attivita.runOnUiThread(() -> {
            Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            i.addCategory(Intent.CATEGORY_OPENABLE);
            i.setType("application/json");
            i.putExtra(Intent.EXTRA_TITLE, nome);
            try { attivita.startActivityForResult(i, MainActivity.RICHIESTA_ESPORTA); }
            catch (ActivityNotFoundException e) { chiama("__esportato", false, "Nessuna app per salvare file disponibile."); }
        });
    }
    void esportaSu(Uri uri) {
        String testo = daEsportare; daEsportare = null;
        if (uri == null || testo == null) { chiama("__esportato", false, "Esportazione annullata."); return; }
        try (OutputStream out = attivita.getContentResolver().openOutputStream(uri, "wt")) {
            if (out == null) throw new IllegalStateException("destinazione non scrivibile");
            out.write(testo.getBytes(StandardCharsets.UTF_8));
            out.flush();
            chiama("__esportato", true, messaggioEsportazione);
        } catch (Exception e) {
            chiama("__esportato", false, "Scrittura del file non riuscita (" + e.getClass().getSimpleName() + ").");
        }
    }

    @JavascriptInterface public void importa() {
        attivita.runOnUiThread(() -> {
            Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            i.addCategory(Intent.CATEGORY_OPENABLE);
            i.setType("*/*");
            i.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/json", "text/plain", "application/octet-stream"});
            try { attivita.startActivityForResult(i, MainActivity.RICHIESTA_IMPORTA); }
            catch (ActivityNotFoundException e) { chiama("__importato", false, "Nessuna app per scegliere file disponibile."); }
        });
    }
    void importaDa(Uri uri) {
        if (uri == null) { chiama("__importato", false, ""); return; }
        try (InputStream in = attivita.getContentResolver().openInputStream(uri)) {
            if (in == null) throw new IllegalStateException("file non leggibile");
            ByteArrayOutputStream b = new ByteArrayOutputStream();
            byte[] buf = new byte[8192]; int n; int tot = 0;
            while ((n = in.read(buf)) > 0) { tot += n; if (tot > MAX_IMPORT) throw new IllegalStateException("file troppo grande"); b.write(buf, 0, n); }
            chiama("__importato", true, b.toString("UTF-8"));
        } catch (Exception e) {
            chiama("__importato", false, "Lettura del file non riuscita (" + e.getMessage() + ").");
        }
    }

    // ---------- varie ----------
    @JavascriptInterface public String infoApp() {
        try {
            PackageInfo p = attivita.getPackageManager().getPackageInfo(attivita.getPackageName(), 0);
            JSONObject o = new JSONObject();
            o.put("versione", p.versionName); o.put("codice", p.getLongVersionCode()); o.put("pacchetto", attivita.getPackageName());
            return o.toString();
        } catch (Exception e) { return "{}"; }
    }

    @JavascriptInterface public void apriLink(String url) {
        if (url == null || !url.startsWith("https://github.com/")) return; // solo pagine di GitHub
        attivita.runOnUiThread(() -> {
            try { attivita.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (ActivityNotFoundException ignorata) { }
        });
    }

    private void chiama(String funzione, boolean ok, String testo) {
        final String js = "window." + funzione + " && window." + funzione + "(" + ok + "," + JSONObject.quote(testo == null ? "" : testo) + ")";
        web.post(() -> web.evaluateJavascript(js, null));
    }
}
