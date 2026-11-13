package it.secondbrain.app;

import android.content.Context;
import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.IOException;
import java.io.InputStream;

/** Serve solo i file di assets/www dall'indirizzo interno; blocca qualsiasi altra risorsa. */
class ClientRisorse extends WebViewClient {
    private final Context ctx;
    ClientRisorse(Context c) { ctx = c.getApplicationContext(); }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
        Uri u = r.getUrl();
        if (!MainActivity.HOST.equals(u.getHost())) return new WebResourceResponse("text/plain", "utf-8", 403, "Bloccato", null, null);
        String p = u.getPath() == null ? "" : u.getPath();
        if (!p.startsWith("/www/") || p.contains("..")) return new WebResourceResponse("text/plain", "utf-8", 404, "Non trovato", null, null);
        try {
            InputStream in = ctx.getAssets().open(p.substring(1));
            String tipo = p.endsWith(".js") ? "text/javascript" : p.endsWith(".css") ? "text/css" : p.endsWith(".svg") ? "image/svg+xml" : "text/html";
            return new WebResourceResponse(tipo, "utf-8", in);
        } catch (IOException e) {
            return new WebResourceResponse("text/plain", "utf-8", 404, "Non trovato", null, null);
        }
    }
}
