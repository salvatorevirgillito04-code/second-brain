package it.secondbrain.app;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.window.OnBackInvokedDispatcher;

import java.io.IOException;
import java.io.InputStream;

/** Contenitore: mostra l'interfaccia (assets/www) e collega il ponte nativo. */
public class MainActivity extends Activity {
    static final String HOST = "appassets.androidplatform.net";
    static final int RICHIESTA_ESPORTA = 1;
    static final int RICHIESTA_IMPORTA = 2;
    static final int RICHIESTA_NOTIFICHE = 3;

    WebView web;
    Ponte ponte;

    @Override
    protected void onCreate(Bundle stato) {
        super.onCreate(stato);
        FrameLayout radice = new FrameLayout(this);
        radice.setBackgroundColor(0xFF1F6F5C);
        web = new WebView(this);
        radice.addView(web, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(radice);

        // Android 15+ disegna sotto le barre di sistema: lascia spazio alle barre e alla tastiera.
        radice.setOnApplyWindowInsetsListener((View v, WindowInsets in) -> {
            Insets i = in.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime() | WindowInsets.Type.displayCutout());
            v.setPadding(i.left, i.top, i.right, i.bottom);
            return WindowInsets.CONSUMED;
        });

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportMultipleWindows(false);
        s.setMediaPlaybackRequiresUserGesture(true);

        web.setWebViewClient(new ClientRisorse(this) {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (HOST.equals(u.getHost())) return false;
                ponte.apriLink(u.toString()); // qualsiasi altro indirizzo si apre nel browser, mai dentro l'app
                return true;
            }
        });

        ponte = new Ponte(this, this, web);
        web.addJavascriptInterface(ponte, "Android");
        web.loadUrl("https://" + HOST + "/www/index.html" + frammento(getIntent()));
        SincronizzazioneJob.pianifica(this);
        eliminaResiduiGlobo();

        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, () -> {
                if (web.canGoBack()) web.goBack(); else finish();
            });
        }
    }

    @Override
    public void onBackPressed() { // Android 10-12
        if (web != null && web.canGoBack()) web.goBack(); else super.onBackPressed();
    }

    static volatile boolean inPrimoPiano = false;

    /** 1.8: il widget del globo è stato eliminato; rimuove i fotogrammi rimasti dalla 1.7. */
    private void eliminaResiduiGlobo() {
        java.io.File d = new java.io.File(getFilesDir(), "globo");
        java.io.File[] f = d.listFiles();
        if (f != null) for (java.io.File x : f) x.delete();
        d.delete();
        new java.io.File(getFilesDir(), "globo.png").delete();
        getSharedPreferences("impostazioni", MODE_PRIVATE).edit().remove("globo_n").remove("globo_v").apply();
    }

    /** Notifiche e widget aprono l'app su una sezione (#stanze) o con un'azione (aggiunta rapida). */
    private static String frammento(Intent i) {
        if (i == null) return "";
        String v = i.getStringExtra("vista"), a = i.getStringExtra("azione");
        if ("rapido".equals(a)) return "#home-rapido";
        return v != null && v.matches("[a-z]{3,20}") ? "#" + v : "";
    }

    @Override
    protected void onNewIntent(Intent i) {
        super.onNewIntent(i);
        String f = frammento(i);
        if (web != null && !f.isEmpty()) web.evaluateJavascript("window.__apri && window.__apri(" + org.json.JSONObject.quote(f.substring(1)) + ")", null);
    }

    @Override
    public void onRequestPermissionsResult(int codice, String[] permessi, int[] esiti) {
        super.onRequestPermissionsResult(codice, permessi, esiti);
        if (codice == RICHIESTA_NOTIFICHE && ponte != null) ponte.esitoNotifiche();
    }

    @Override
    protected void onPause() { inPrimoPiano = false; super.onPause(); }

    @Override
    protected void onResume() {
        super.onResume();
        inPrimoPiano = true;
        if (web != null) web.evaluateJavascript("window.__ripresa && window.__ripresa()", null);
    }

    @Override
    protected void onActivityResult(int codice, int esito, Intent dati) {
        super.onActivityResult(codice, esito, dati);
        Uri uri = (esito == RESULT_OK && dati != null) ? dati.getData() : null;
        if (codice == RICHIESTA_ESPORTA) ponte.esportaSu(uri);
        else if (codice == RICHIESTA_IMPORTA) ponte.importaDa(uri);
    }

    @Override
    protected void onDestroy() {
        if (web != null) { web.removeJavascriptInterface("Android"); web.destroy(); }
        super.onDestroy();
    }
}
