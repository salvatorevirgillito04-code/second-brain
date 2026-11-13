package it.secondbrain.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

import org.json.JSONObject;

/** Widget della schermata Home: conteggi dall'ultimo salvataggio dell'app e pulsante per l'aggiunta rapida. */
public class WidgetSecondBrain extends AppWidgetProvider {
    static void aggiornaTutti(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        int[] ids = m.getAppWidgetIds(new ComponentName(c, WidgetSecondBrain.class));
        if (ids.length > 0) new WidgetSecondBrain().onUpdate(c, m, ids);
    }

    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        JSONObject d;
        try { d = new JSONObject(c.getSharedPreferences("impostazioni", Context.MODE_PRIVATE).getString("widget", "{}")); } catch (Exception e) { d = new JSONObject(); }
        for (int id : ids) {
            RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget);
            v.setTextViewText(R.id.w_inbox, String.valueOf(d.optInt("inbox", 0)));
            v.setTextViewText(R.id.w_progetti, String.valueOf(d.optInt("progetti", 0)));
            v.setTextViewText(R.id.w_attesa, String.valueOf(d.optInt("attesa", 0)));
            String ril = d.optString("rilevato", "");
            v.setTextViewText(R.id.w_nota, ril.length() >= 16 ? "Stato agenti del " + ril.substring(8, 10) + "/" + ril.substring(5, 7) + " " + ril.substring(11, 16) + " UTC" : "Nessuna rilevazione degli agenti");
            v.setOnClickPendingIntent(R.id.w_radice, apri(c, "home", null, 10));
            v.setOnClickPendingIntent(R.id.w_attesa_box, apri(c, "stanze", null, 11));
            v.setOnClickPendingIntent(R.id.w_piu, apri(c, null, "rapido", 12));
            m.updateAppWidget(id, v);
        }
    }

    private static PendingIntent apri(Context c, String vista, String azione, int codice) {
        Intent i = new Intent(c, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        if (vista != null) i.putExtra("vista", vista);
        if (azione != null) i.putExtra("azione", azione);
        return PendingIntent.getActivity(c, codice, i, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }
}
