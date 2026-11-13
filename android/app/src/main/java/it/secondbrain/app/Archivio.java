package it.secondbrain.app;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;

/**
 * Dati dell'app nella memoria privata (files/). Sopravvive agli aggiornamenti dell'APK firmati con la stessa chiave.
 * Scrittura atomica: file temporaneo + sync + rinomina; la versione precedente resta in dati.prec.json.
 */
class Archivio {
    private final File principale, precedente, temporaneo;

    Archivio(File cartella) {
        principale = new File(cartella, "dati.json");
        precedente = new File(cartella, "dati.prec.json");
        temporaneo = new File(cartella, "dati.tmp");
    }

    synchronized String leggi(boolean prec) {
        File f = prec ? precedente : principale;
        if (!f.exists()) return "";
        try (FileInputStream in = new FileInputStream(f)) {
            byte[] b = new byte[(int) f.length()];
            int letti = 0;
            while (letti < b.length) { int n = in.read(b, letti, b.length - letti); if (n < 0) break; letti += n; }
            return new String(b, 0, letti, StandardCharsets.UTF_8);
        } catch (IOException e) {
            return "";
        }
    }

    /** Copia di sicurezza con nome fisso: non sovrascrive mai un file esistente. */
    synchronized String scriviCopia(String nome, String testo) throws IOException {
        if (nome == null || !nome.matches("[a-z0-9.-]{1,80}\\.json") || nome.startsWith("dati.")) throw new IOException("nome non valido");
        File f = new File(principale.getParentFile(), nome);
        if (f.exists()) return "esiste";
        File tmp = new File(principale.getParentFile(), nome + ".tmp");
        try (FileOutputStream out = new FileOutputStream(tmp)) { out.write(testo.getBytes(StandardCharsets.UTF_8)); out.getFD().sync(); }
        Files.move(tmp.toPath(), f.toPath(), StandardCopyOption.ATOMIC_MOVE);
        return "ok";
    }

    synchronized void scrivi(String json) throws IOException {
        if (json == null || json.isEmpty()) throw new IOException("contenuto vuoto");
        try (FileOutputStream out = new FileOutputStream(temporaneo)) {
            out.write(json.getBytes(StandardCharsets.UTF_8));
            out.getFD().sync();
        }
        if (principale.exists()) Files.copy(principale.toPath(), precedente.toPath(), StandardCopyOption.REPLACE_EXISTING);
        Files.move(temporaneo.toPath(), principale.toPath(), StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
    }
}
