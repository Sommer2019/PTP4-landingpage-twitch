import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Paths;

public class StaticDirHandler implements HttpHandler {
    private final String resourceDir;

    public StaticDirHandler(String resourceDir) {
        this.resourceDir = resourceDir;
    }

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        if (OverlayApiServer.handleCorsPreFlight(exchange)) return;
        OverlayApiServer.addCorsHeaders(exchange);
        String uri = exchange.getRequestURI().getPath();
        String fileName = uri.substring(uri.lastIndexOf("/") + 1);
        String resourcePath = resourceDir + "/" + fileName;
        try (java.io.InputStream is = getClass().getClassLoader().getResourceAsStream(resourcePath)) {
            if (is == null) {
                exchange.sendResponseHeaders(404, 0);
                exchange.getResponseBody().close();
                return;
            }
            String contentType = Files.probeContentType(Paths.get(fileName));
            byte[] data = is.readAllBytes();
            exchange.getResponseHeaders().add("Content-Type", contentType != null ? contentType : "application/octet-stream");
            exchange.sendResponseHeaders(200, data.length);
            OutputStream os = exchange.getResponseBody();
            os.write(data);
            os.close();
        } catch (IOException e) {
            exchange.sendResponseHeaders(500, 0);
            exchange.getResponseBody().close();
        }
    }
}

