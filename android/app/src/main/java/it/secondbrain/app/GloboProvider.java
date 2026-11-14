package it.secondbrain.app;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;

import java.io.File;
import java.io.FileNotFoundException;
import java.util.List;

/**
 * Fornisce SOLO i fotogrammi del widget del globo (files/globo/fN.png), in sola lettura.
 * Non esportato: il launcher li legge grazie a un permesso temporaneo concesso da WidgetGlobo.
 * Indirizzo: content://it.secondbrain.app.globo/<versione>/fN.png (la versione serve solo a far ricaricare le immagini).
 */
public class GloboProvider extends ContentProvider {
    static final String AUTORITA = "it.secondbrain.app.globo";

    @Override public boolean onCreate() { return true; }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String modo) throws FileNotFoundException {
        if (!"r".equals(modo)) throw new FileNotFoundException("sola lettura");
        List<String> p = uri.getPathSegments();
        String nome = p.isEmpty() ? "" : p.get(p.size() - 1);
        if (!nome.matches("f\\d{1,2}\\.png")) throw new FileNotFoundException("non disponibile");
        File f = new File(new File(getContext().getFilesDir(), WidgetGlobo.CARTELLA), nome);
        if (!f.isFile()) throw new FileNotFoundException("non disponibile");
        return ParcelFileDescriptor.open(f, ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override public String getType(Uri uri) { return "image/png"; }
    @Override public Cursor query(Uri u, String[] p, String s, String[] a, String o) { return null; }
    @Override public Uri insert(Uri u, ContentValues v) { return null; }
    @Override public int delete(Uri u, String s, String[] a) { return 0; }
    @Override public int update(Uri u, ContentValues v, String s, String[] a) { return 0; }
}
