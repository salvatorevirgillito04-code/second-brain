package it.secondbrain.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.view.View;
import android.widget.RemoteViews;

import java.io.File;
import java.io.FileOutputStream;

/** Widget del globo neurale: immagine disegnata dall'app (globo.js) e salvata in files/globo.png. Tocco = Mappa. */
public class WidgetGlobo extends AppWidgetProvider {
    static final String FILE = "globo.png";
    static final int MAX_BYTE = 3 * 1024 * 1024;

    /** Salva l'immagine in modo atomico (file temporaneo + rinomina) e aggiorna i widget. */
    static void salva(Context c, byte[] png) throws Exception {
        if (png.length == 0 || png.length > MAX_BYTE) throw new IllegalArgumentException("dimensione non valida");
        if (BitmapFactory.decodeByteArray(png, 0, png.length, new BitmapFactory.Options()) == null) throw new IllegalArgumentException("immagine non valida");
        File tmp = new File(c.getFilesDir(), FILE + ".tmp");
        try (FileOutputStream o = new FileOutputStream(tmp)) { o.write(png); o.getFD().sync(); }
        if (!tmp.renameTo(new File(c.getFilesDir(), FILE))) throw new IllegalStateException("rinomina non riuscita");
        aggiornaTutti(c);
    }

    static void aggiornaTutti(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, WidgetGlobo.class));
        if (ids.length > 0) new WidgetGlobo().onUpdate(c, m, ids);
    }

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        Bitmap b = null;
        File f = new File(c.getFilesDir(), FILE);
        if (f.exists()) { BitmapFactory.Options o = new BitmapFactory.Options(); o.inSampleSize = 1; b = BitmapFactory.decodeFile(f.getPath(), o); }
        Intent i = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP).putExtra("vista", "mappa");
        PendingIntent pi = PendingIntent.getActivity(c, 20, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        for (int id : ids) {
            RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget_globo);
            if (b != null) { v.setImageViewBitmap(R.id.g_img, b); v.setViewVisibility(R.id.g_vuoto, View.GONE); }
            else v.setViewVisibility(R.id.g_vuoto, View.VISIBLE);
            v.setOnClickPendingIntent(R.id.g_radice, pi);
            m.updateAppWidget(id, v);
        }
    }
}
