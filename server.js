const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Usamos cors para permitir que tu página frontend se comunique con este backend
app.use(cors());

// Esta es la ruta "mágica". Recibirá la URL que el usuario pegue.
// Ejemplo de cómo la llamarías: /scrape?url=https://pagina-de-futbol.com/embed/...
app.get('/scrape', (req, res) => {
    const urlToScrape = req.query.url;

    if (!urlToScrape) {
        return res.status(400).json({ error: 'No se proporcionó ninguna URL.' });
    }

    console.log(`Recibida petición para scrapear: ${urlToScrape}`);

    // --- LÓGICA DE SCRAPING (AQUÍ IRÍA PUPPETEER/SELENIUM) ---
    // Por ahora, vamos a simular que encontramos un enlace .m3u8
    // Reemplaza esta URL con una real para hacer pruebas.
    const foundStreamUrl = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';

    console.log(`Enlace encontrado (simulado): ${foundStreamUrl}`);

    // Devolvemos el enlace encontrado en formato JSON
    res.json({ streamUrl: foundStreamUrl });
});

app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
});