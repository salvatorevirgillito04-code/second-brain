package it.secondbrain.app;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.SocketTimeoutException;
import java.net.URL;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;

/** Richieste all'API REST di GitHub. Stato 0 = rete assente o risposta non ricevuta. Nessun log. */
class ClientGitHub {
    static final class Risposta {
        final int stato; final String corpo;
        Risposta(int s, String c) { stato = s; corpo = c; }
    }

    Risposta invia(String token, String metodo, String percorso, String corpo) {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL("https://api.github.com" + percorso).openConnection();
            c.setRequestMethod(metodo);
            c.setConnectTimeout(15000);
            c.setReadTimeout(30000);
            c.setUseCaches(false);
            c.setInstanceFollowRedirects(false);
            c.setRequestProperty("Authorization", "Bearer " + token);
            c.setRequestProperty("Accept", "application/vnd.github+json");
            c.setRequestProperty("X-GitHub-Api-Version", "2022-11-28");
            c.setRequestProperty("User-Agent", "SecondBrainApp");
            if (corpo != null && !corpo.isEmpty()) {
                byte[] b = corpo.getBytes(StandardCharsets.UTF_8);
                c.setDoOutput(true);
                c.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                c.setFixedLengthStreamingMode(b.length);
                try (OutputStream out = c.getOutputStream()) { out.write(b); }
            }
            int stato = c.getResponseCode();
            InputStream in = stato >= 400 ? c.getErrorStream() : c.getInputStream();
            return new Risposta(stato, in == null ? "" : leggi(in));
        } catch (UnknownHostException | SocketTimeoutException e) {
            return new Risposta(0, "{\"message\":\"rete assente\"}");
        } catch (IOException e) {
            return new Risposta(0, "{\"message\":\"connessione interrotta\"}");
        } finally {
            if (c != null) c.disconnect();
        }
    }

    private static String leggi(InputStream in) throws IOException {
        try (InputStream i = in) {
            ByteArrayOutputStream b = new ByteArrayOutputStream();
            byte[] buf = new byte[8192]; int n;
            while ((n = i.read(buf)) > 0) b.write(buf, 0, n);
            return b.toString("UTF-8");
        }
    }
}
