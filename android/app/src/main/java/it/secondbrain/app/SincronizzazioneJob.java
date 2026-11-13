package it.secondbrain.app;

import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebView;

/**
 * Sincronizzazione periodica in background (ogni 30 minuti circa, solo con rete), anche ad app chiusa.
 * Usa lo stesso motore dell'app (motore.js) in una WebView invisibile. Si salta se l'app è in primo piano.
 */
public class SincronizzazioneJob extends JobService {
    static final int ID = 1;
    static final long INTERVALLO_MS = 30 * 60 * 1000L;
    static final long LIMITE_MS = 8 * 60 * 1000L;
    private WebView web;
    private final Handler principale = new Handler(Looper.getMainLooper());

    static void pianifica(Context c) {
        JobScheduler js = c.getSystemService(JobScheduler.class);
        if (js == null || js.getPendingJob(ID) != null) return;
        js.schedule(new JobInfo.Builder(ID, new ComponentName(c, SincronizzazioneJob.class))
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setPeriodic(INTERVALLO_MS)
                .setPersisted(true)
                .build());
    }

    @Override
    public boolean onStartJob(JobParameters params) {
        if (MainActivity.inPrimoPiano) return false; // ci pensa l'app aperta
        principale.post(() -> {
            web = new WebView(getApplicationContext());
            web.getSettings().setJavaScriptEnabled(true);
            web.getSettings().setAllowFileAccess(false);
            web.getSettings().setAllowContentAccess(false);
            web.setWebViewClient(new ClientRisorse(this));
            Ponte p = new Ponte(this, null, web);
            p.allaFine = () -> chiudi(params);
            web.addJavascriptInterface(p, "Android");
            web.loadUrl("https://" + MainActivity.HOST + "/www/sfondo.html");
            principale.postDelayed(() -> chiudi(params), LIMITE_MS);
        });
        return true;
    }

    private void chiudi(JobParameters params) {
        if (web == null) return;
        WebView w = web; web = null;
        w.removeJavascriptInterface("Android");
        w.destroy();
        jobFinished(params, false);
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        principale.post(() -> { if (web != null) { web.destroy(); web = null; } });
        return true; // riprova più tardi
    }
}
