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
    static final int MAX_FILE = 60 * 1024 * 1024;
    private boolean binario = false;

    private final MainActivity attivita; // null quando gira in background
    private final android.content.Context ctx;
    private final WebView web;
    private final Cassaforte routine;
    private final android.content.SharedPreferences prefs;
    Runnable allaFine;
    String esitoFine;
    private final Archivio archivio;
    private final Cassaforte cassaforte;
    private final ClientGitHub github;
    private final ExecutorService rete = Executors.newSingleThreadExecutor();
    private byte[] daEsportare;
    private String messaggioEsportazione;

    Ponte(android.content.Context c, MainActivity a, WebView w) {
        ctx = c.getApplicationContext(); attivita = a; web = w;
        archivio = new Archivio(ctx.getFilesDir());
        cassaforte = new Cassaforte(ctx);
        routine = new Cassaforte(ctx, "second_brain_routine", "routine_cifrato");
        prefs = ctx.getSharedPreferences("impostazioni", android.content.Context.MODE_PRIVATE);
        github = new ClientGitHub();
    }

    // ---------- attività pianificata di Claude Code (avvio dal telefono) ----------
    @JavascriptInterface public boolean haRoutine() { return routine.presente() && prefs.contains("routine_id"); }
    @JavascriptInterface public String idRoutine() { return prefs.getString("routine_id", ""); }
    @JavascriptInterface public String impostaRoutine(String id, String token) {
        if (id == null || !id.trim().matches("trig_[A-Za-z0-9]{10,60}")) return "Identificativo non valido: deve iniziare con trig_.";
        if (token == null || !token.trim().startsWith("sk-ant-oat01-") || token.trim().length() > 300) return "Token non valido: deve iniziare con sk-ant-oat01-.";
        try { routine.salva(token.trim()); prefs.edit().putString("routine_id", id.trim()).commit(); return "ok"; }
        catch (Exception e) { return "Impossibile salvare il token in modo cifrato (" + e.getClass().getSimpleName() + ")."; }
    }
    @JavascriptInterface public void rimuoviRoutine() { routine.rimuovi(); prefs.edit().remove("routine_id").commit(); }
    @JavascriptInterface public void avviaRoutine(final String id) {
        rete.execute(() -> {
            String rid = prefs.getString("routine_id", ""), tok = routine.leggi();
            ClientGitHub.Risposta r = (tok == null || rid.isEmpty()) ? new ClientGitHub.Risposta(401, "{\"message\":\"token assente\"}")
                : github.richiesta("https://api.anthropic.com/v1/claude_code/routines/" + rid + "/fire", "POST", "{\"text\":\"Avviato dall'app Second Brain\"}",
                    new String[][]{{"Authorization", "Bearer " + tok}, {"anthropic-version", "2023-06-01"}, {"anthropic-beta", "experimental-cc-routine-2026-04-01"}});
            final String js = "window.__risposta(" + JSONObject.quote(id) + "," + r.stato + "," + JSONObject.quote(r.corpo == null ? "" : r.corpo) + ")";
            web.post(() -> web.evaluateJavascript(js, null));
        });
    }

    // ---------- 1.4: notifiche e widget ----------
    @JavascriptInterface public boolean notificheConsentite() {
        if (android.os.Build.VERSION.SDK_INT >= 33 && ctx.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) return false;
        return ctx.getSystemService(android.app.NotificationManager.class).areNotificationsEnabled();
    }
    /** Chiede il permesso (Android 13+); l'esito arriva a window.__notifiche(true|false). */
    @JavascriptInterface public void richiediNotifiche() {
        if (attivita == null) return;
        attivita.runOnUiThread(() -> {
            if (android.os.Build.VERSION.SDK_INT >= 33) attivita.requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, MainActivity.RICHIESTA_NOTIFICHE);
            else chiama("__notifiche", notificheConsentite(), "");
        });
    }
    void esitoNotifiche() { chiama("__notifiche", notificheConsentite(), ""); }
    @JavascriptInterface public boolean notifica(String id, String titolo, String testo) {
        if (!notificheConsentite()) return false;
        android.app.NotificationManager nm = ctx.getSystemService(android.app.NotificationManager.class);
        nm.createNotificationChannel(new android.app.NotificationChannel("interventi", "Interventi richiesti dalle sessioni", android.app.NotificationManager.IMPORTANCE_DEFAULT));
        Intent apri = new Intent(ctx, MainActivity.class).putExtra("vista", "stanze").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        android.app.PendingIntent pi = android.app.PendingIntent.getActivity(ctx, Math.abs(id.hashCode()), apri, android.app.PendingIntent.FLAG_IMMUTABLE | android.app.PendingIntent.FLAG_UPDATE_CURRENT);
        android.app.Notification n = new android.app.Notification.Builder(ctx, "interventi")
                .setSmallIcon(R.drawable.ic_notifica).setContentTitle(titolo).setContentText(testo)
                .setStyle(new android.app.Notification.BigTextStyle().bigText(testo)).setContentIntent(pi).setAutoCancel(true).build();
        nm.notify(id, 1, n);
        return true;
    }
    @JavascriptInterface public void aggiornaWidget(String json) {
        prefs.edit().putString("widget", json == null ? "{}" : json).apply();
        WidgetSecondBrain.aggiornaTutti(ctx);
    }

    /** Chiamato da sfondo.html al termine della sincronizzazione in background. */
    @JavascriptInterface public void fine(String esito) { esitoFine = esito; if (allaFine != null) web.post(allaFine); }

    // ---------- archivio locale ----------
    @JavascriptInterface public String caricaDati() { return archivio.leggi(false); }
    @JavascriptInterface public String caricaDatiPrecedenti() { return archivio.leggi(true); }
    @JavascriptInterface public String salvaDati(String json) {
        try { archivio.scrivi(json); return "ok"; } catch (Exception e) { return "errore di scrittura (" + e.getClass().getSimpleName() + ")"; }
    }

    @JavascriptInterface public String salvaCopia(String nome, String testo) {
        try { return archivio.scriviCopia(nome, testo); } catch (Exception e) { return "errore (" + e.getClass().getSimpleName() + ")"; }
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
        ConnectivityManager cm = ctx.getSystemService(ConnectivityManager.class);
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
        if (testo == null) return;
        salvaConScelta(nome, testo.getBytes(StandardCharsets.UTF_8), "application/json", messaggioOk);
    }
    /** Come esporta(), per file binari (es. lo ZIP per Obsidian), passati in base64. Massimo 60 MB. */
    @JavascriptInterface public void esportaBinario(String nome, String b64, String tipo, String messaggioOk) {
        if (b64 == null || b64.length() > 80 * 1024 * 1024) { chiama("__esportato", false, "File troppo grande."); return; }
        byte[] dati;
        try { dati = android.util.Base64.decode(b64, android.util.Base64.DEFAULT); } catch (Exception e) { chiama("__esportato", false, "Dati non validi."); return; }
        salvaConScelta(nome, dati, tipo == null || !tipo.matches("[a-z]+/[a-z0-9.+-]+") ? "application/octet-stream" : tipo, messaggioOk);
    }
    private void salvaConScelta(String nome, byte[] dati, String tipo, String messaggioOk) {
        if (attivita == null) return;
        daEsportare = dati; messaggioEsportazione = messaggioOk;
        attivita.runOnUiThread(() -> {
            Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            i.addCategory(Intent.CATEGORY_OPENABLE);
            i.setType(tipo);
            i.putExtra(Intent.EXTRA_TITLE, nome);
            try { attivita.startActivityForResult(i, MainActivity.RICHIESTA_ESPORTA); }
            catch (ActivityNotFoundException e) { chiama("__esportato", false, "Nessuna app per salvare file disponibile."); }
        });
    }
    void esportaSu(Uri uri) {
        byte[] dati = daEsportare; daEsportare = null;
        if (uri == null || dati == null) { chiama("__esportato", false, "Esportazione annullata."); return; }
        try (OutputStream out = attivita.getContentResolver().openOutputStream(uri, "wt")) {
            if (out == null) throw new IllegalStateException("destinazione non scrivibile");
            out.write(dati);
            out.flush();
            chiama("__esportato", true, messaggioEsportazione);
        } catch (Exception e) {
            chiama("__esportato", false, "Scrittura del file non riuscita (" + e.getClass().getSimpleName() + ").");
        }
    }

    @JavascriptInterface public void importa() { avviaScelta(false); }
    /** Come importa(), ma restituisce i byte in base64 (per gli archivi ZIP dell'esportazione di Claude). */
    @JavascriptInterface public void importaFile() { avviaScelta(true); }
    private void avviaScelta(boolean bin) {
        if (attivita == null) return;
        binario = bin;
        attivita.runOnUiThread(() -> {
            Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            i.addCategory(Intent.CATEGORY_OPENABLE);
            i.setType("*/*");
            if (!binario) i.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"application/json", "text/plain", "application/octet-stream"});
            try { attivita.startActivityForResult(i, MainActivity.RICHIESTA_IMPORTA); }
            catch (ActivityNotFoundException e) { chiama("__importato", false, "Nessuna app per scegliere file disponibile."); }
        });
    }
    void importaDa(Uri uri) {
        if (binario) { importaBinario(uri); return; }
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

    private void importaBinario(Uri uri) {
        if (uri == null) { chiama("__fileScelto", false, ""); return; }
        new Thread(() -> {
            try (InputStream in = attivita.getContentResolver().openInputStream(uri)) {
                if (in == null) throw new IllegalStateException("file non leggibile");
                ByteArrayOutputStream b = new ByteArrayOutputStream();
                byte[] buf = new byte[65536]; int n; long tot = 0;
                while ((n = in.read(buf)) > 0) { tot += n; if (tot > MAX_FILE) throw new IllegalStateException("file più grande di 60 MB"); b.write(buf, 0, n); }
                chiama("__fileScelto", true, android.util.Base64.encodeToString(b.toByteArray(), android.util.Base64.NO_WRAP));
            } catch (Exception e) {
                chiama("__fileScelto", false, "Lettura del file non riuscita (" + e.getMessage() + ").");
            }
        }).start();
    }

    // ---------- varie ----------
    @JavascriptInterface public String infoApp() {
        try {
            PackageInfo p = ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), 0);
            JSONObject o = new JSONObject();
            o.put("versione", p.versionName); o.put("codice", p.getLongVersionCode()); o.put("pacchetto", ctx.getPackageName());
            return o.toString();
        } catch (Exception e) { return "{}"; }
    }

    @JavascriptInterface public void apriLink(String url) {
        if (attivita == null || url == null || !(url.startsWith("https://github.com/") || url.startsWith("https://claude.ai/"))) return; // solo GitHub e claude.ai
        attivita.runOnUiThread(() -> {
            try { attivita.startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (ActivityNotFoundException ignorata) { }
        });
    }

    void chiama(String funzione, boolean ok, String testo) {
        final String js = "window." + funzione + " && window." + funzione + "(" + ok + "," + JSONObject.quote(testo == null ? "" : testo) + ")";
        web.post(() -> web.evaluateJavascript(js, null));
    }
}
