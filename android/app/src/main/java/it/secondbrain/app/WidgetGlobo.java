package it.secondbrain.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;

import java.io.File;
import java.io.FileOutputStream;

/**
 * Widget del globo neurale ANIMATO: i widget Android non eseguono codice di disegno, quindi l'app prepara
 * una sequenza di fotogrammi (globo.js) e il launcher li sfoglia in ciclo con un ViewFlipper.
 * Tocco = Mappa.
 */
public class WidgetGlobo extends AppWidgetProvider {
    static final String CARTELLA = "globo";
    static final int MAX = 24, MAX_BYTE = 1024 * 1024;
    static final int[] FOTO = {
        R.id.g_f0, R.id.g_f1, R.id.g_f2, R.id.g_f3, R.id.g_f4, R.id.g_f5, R.id.g_f6, R.id.g_f7, R.id.g_f8, R.id.g_f9, R.id.g_f10, R.id.g_f11,
        R.id.g_f12, R.id.g_f13, R.id.g_f14, R.id.g_f15, R.id.g_f16, R.id.g_f17, R.id.g_f18, R.id.g_f19, R.id.g_f20, R.id.g_f21, R.id.g_f22, R.id.g_f23 };

    private static File cartella(Context c) { File d = new File(c.getFilesDir(), CARTELLA); if (!d.isDirectory()) d.mkdirs(); return d; }

    /** Fotogramma i in un file temporaneo (diventa visibile solo con pubblica). */
    static void fotogramma(Context c, int i, byte[] png) throws Exception {
        if (i < 0 || i >= MAX) throw new IllegalArgumentException("indice non valido");
        if (png.length == 0 || png.length > MAX_BYTE) throw new IllegalArgumentException("dimensione non valida");
        BitmapFactory.Options o = new BitmapFactory.Options(); o.inJustDecodeBounds = true; BitmapFactory.decodeByteArray(png, 0, png.length, o);
        if (o.outWidth <= 0 || o.outWidth > 512 || o.outHeight > 512) throw new IllegalArgumentException("immagine non valida");
        File tmp = new File(cartella(c), "f" + i + ".png.tmp");
        try (FileOutputStream out = new FileOutputStream(tmp)) { out.write(png); out.getFD().sync(); }
    }

    /** Rende visibili i fotogrammi 0..n-1 tutti insieme e aggiorna i widget. */
    static void pubblica(Context c, int n) throws Exception {
        if (n < 1 || n > MAX) throw new IllegalArgumentException("numero non valido");
        File d = cartella(c);
        for (int i = 0; i < n; i++) if (!new File(d, "f" + i + ".png.tmp").isFile()) throw new IllegalStateException("fotogramma mancante");
        for (int i = 0; i < n; i++) if (!new File(d, "f" + i + ".png.tmp").renameTo(new File(d, "f" + i + ".png"))) throw new IllegalStateException("rinomina non riuscita");
        prefs(c).edit().putInt("globo_n", n).putLong("globo_v", System.currentTimeMillis()).apply();
        aggiornaTutti(c);
    }

    private static SharedPreferences prefs(Context c) { return c.getSharedPreferences("impostazioni", Context.MODE_PRIVATE); }

    static void aggiornaTutti(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, WidgetGlobo.class));
        if (ids.length > 0) new WidgetGlobo().onUpdate(c, m, ids);
    }

    /** Permesso di lettura dei soli fotogrammi ai launcher installati (chi mostra il widget). */
    private static void concedi(Context c, Uri base) {
        Intent home = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME);
        for (ResolveInfo r : c.getPackageManager().queryIntentActivities(home, PackageManager.MATCH_DEFAULT_ONLY))
            c.grantUriPermission(r.activityInfo.packageName, base, Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
    }

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        int n = Math.min(prefs(c).getInt("globo_n", 0), MAX);
        long v = prefs(c).getLong("globo_v", 0);
        Uri base = Uri.parse("content://" + GloboProvider.AUTORITA + "/");
        if (n > 0) concedi(c, base);
        Intent i = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP).putExtra("vista", "mappa");
        PendingIntent pi = PendingIntent.getActivity(c, 20, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        for (int id : ids) {
            RemoteViews r = new RemoteViews(c.getPackageName(), R.layout.widget_globo);
            for (int k = 0; k < MAX; k++) {
                if (k < n) { r.setImageViewUri(FOTO[k], base.buildUpon().appendPath("v" + v).appendPath("f" + k + ".png").build()); r.setViewVisibility(FOTO[k], View.VISIBLE); }
                else r.setViewVisibility(FOTO[k], View.GONE);
            }
            r.setViewVisibility(R.id.g_vuoto, n > 0 ? View.GONE : View.VISIBLE);
            r.setViewVisibility(R.id.g_flip, n > 0 ? View.VISIBLE : View.GONE);
            r.setOnClickPendingIntent(R.id.g_radice, pi);
            m.updateAppWidget(id, r);
        }
    }
}
