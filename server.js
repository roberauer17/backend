const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');

const app = express();
const PORT = process.env.PORT || 6000;

app.use(cors());

app.get('/scrape', async (req, res) => { // La función ahora es 'async' para usar Puppeteer
    const urlToScrape = req.query.url;

    if (!urlToScrape) {
        return res.status(400).json({ error: 'No se proporcionó ninguna URL.' });
    }

    console.log(`Iniciando scraping para: ${urlToScrape}`);
    let browser = null;

    try {
        // 1. Lanzamos un navegador invisible en el servidor
        browser = await puppeteer.launch({
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--single-process'
            ],
            headless: true // 'true' significa que no tiene interfaz gráfica
        });

        const page = await browser.newPage();

        let foundStreamUrl = null;

        // 2. Le decimos a la página que nos avise de todas las peticiones de red
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            // 3. Si una petición es a un archivo .m3u8, la guardamos y dejamos de interceptar
            if (request.url().endsWith('.m3u8') && !foundStreamUrl) {
                console.log('¡Stream .m3u8 encontrado! ->', request.url());
                foundStreamUrl = request.url();
                page.setRequestInterception(false); // Optimización: ya tenemos lo que queremos
            }
            request.continue();
        });

        // 4. Visitamos la página que nos pidió el usuario
        await page.goto(urlToScrape, { waitUntil: 'networkidle2', timeout: 30000 });

        // 5. A veces el stream tarda en cargar, le damos unos segundos extra por si acaso
        if (!foundStreamUrl) {
            console.log('Stream no encontrado de inmediato, esperando 5 segundos más...');
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        // 6. Respondemos al usuario con el enlace encontrado o con un error
        if (foundStreamUrl) {
            res.json({ streamUrl: foundStreamUrl });
        } else {
            res.status(404).json({ error: 'No se pudo encontrar un stream .m3u8 en la página.' });
        }

    } catch (error) {
        console.error('Error durante el scraping:', error);
        res.status(500).json({ error: 'Ocurrió un error en el servidor al procesar la página.' });
    } finally {
        // 7. Cerramos el navegador para liberar recursos
        if (browser) {
            await browser.close();
            console.log('Navegador cerrado.');
        }
    }
});

app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);

});
