const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');

console.log("--- Running Detective Final y Limpio v6 ---");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

app.get('/scrape', async (req, res) => {
    const urlToScrape = req.query.url;

    if (!urlToScrape) {
        return res.status(400).json({ error: 'No se proporcionó ninguna URL.' });
    }

    console.log(`Iniciando scraping para: ${urlToScrape}`);
    let browser = null;
    let responseSent = false;

    try {
        browser = await puppeteer.launch({
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--single-process'
            ],
            headless: true
        });
        
        const page = await browser.newPage();

        const timeout = setTimeout(() => {
            if (!responseSent) {
                console.log('Tiempo de espera agotado.');
                res.status(404).json({ error: 'No se pudo encontrar un stream en el tiempo límite.' });
                responseSent = true;
            }
        }, 25000);

        const findStreamAndRespond = (request) => {
            if (request.url().includes('.m3u8') && !responseSent) {
                console.log('¡Stream .m3u8 encontrado! ->', request.url());
                responseSent = true;
                clearTimeout(timeout);
                
                res.json({ streamUrl: request.url() });
                
                page.off('request', findStreamAndRespond);
            }
            else if (!request.isInterceptResolutionHandled()) {
                 request.continue();
            }
        };

        page.on('request', findStreamAndRespond);
        await page.setRequestInterception(true);

        await page.goto(urlToScrape, { waitUntil: 'networkidle2', timeout: 60000 });

        // --- CORRECCIÓN FINAL AQUÍ ---
        // El listener de la página principal ya escucha los iframes.
        // No necesitamos hacer nada más especial con el iframe.
        const iframe = await page.$('iframe');
        if (iframe) {
            console.log('Iframe encontrado. El listener principal se encargará.');
        }

    } catch (error) {
        console.error('Error durante el scraping:', error.message);
        if (!responseSent) {
            res.status(500).json({ error: `Ocurrió un error en el servidor: ${error.message}` });
            responseSent = true;
        }
    } finally {
        if (browser) {
            setTimeout(() => {
                browser.close();
                console.log('Navegador cerrado.');
            }, 2000);
        }
    }
});

app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
});

