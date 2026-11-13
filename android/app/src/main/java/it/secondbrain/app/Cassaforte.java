package it.secondbrain.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/**
 * Token GitHub cifrato con AES-256-GCM; la chiave sta nell'Android Keystore e non è esportabile.
 * Il token non viene mai scritto nei log né restituito all'interfaccia.
 */
class Cassaforte {
    private final String ALIAS;
    private final String CAMPO;
    private final SharedPreferences prefs;

    /** Token GitHub (nomi invariati dalla 1.0 per conservare il token già salvato). */
    Cassaforte(Context c) { this(c, "second_brain_token", "token_cifrato"); }
    Cassaforte(Context c, String alias, String campo) { ALIAS = alias; CAMPO = campo; prefs = c.getSharedPreferences("cassaforte", Context.MODE_PRIVATE); }

    boolean presente() { return prefs.contains(CAMPO); }

    synchronized void salva(String token) throws Exception {
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.ENCRYPT_MODE, chiave());
        byte[] iv = c.getIV();
        byte[] dati = c.doFinal(token.getBytes(StandardCharsets.UTF_8));
        byte[] tutto = new byte[iv.length + dati.length];
        System.arraycopy(iv, 0, tutto, 0, iv.length);
        System.arraycopy(dati, 0, tutto, iv.length, dati.length);
        prefs.edit().putString(CAMPO, Base64.encodeToString(tutto, Base64.NO_WRAP)).commit();
    }

    /** Restituisce il token o null; se la chiave non è più valida (es. dati ripristinati su altro telefono) lo elimina. */
    synchronized String leggi() {
        String v = prefs.getString(CAMPO, null);
        if (v == null) return null;
        try {
            byte[] tutto = Base64.decode(v, Base64.NO_WRAP);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, chiave(), new GCMParameterSpec(128, tutto, 0, 12));
            return new String(c.doFinal(tutto, 12, tutto.length - 12), StandardCharsets.UTF_8);
        } catch (Exception e) {
            rimuovi();
            return null;
        }
    }

    synchronized void rimuovi() { prefs.edit().remove(CAMPO).commit(); }

    private SecretKey chiave() throws Exception {
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        if (ks.containsAlias(ALIAS)) return ((KeyStore.SecretKeyEntry) ks.getEntry(ALIAS, null)).getSecretKey();
        KeyGenerator g = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        g.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build());
        return g.generateKey();
    }
}
