const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');

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
        
        // --- ESTRATEGIA MEJORADA ---
        // Creamos una "promesa" que se resolverá cuando encontremos la URL
        const streamUrlPromise = new Promise(async (resolve, reject) => {
            page.on('request', (request) => {
                if (request.url().includes('.m3u8')) {
                    console.log('¡Stream .m3u8 encontrado! ->', request.url());
                    resolve(request.url()); // Resolvemos la promesa con la URL
                }
                request.continue();
            });

            // Navegamos a la página
            await page.setRequestInterception(true);
            await page.goto(urlToScrape, { waitUntil: 'networkidle2', timeout: 60000 });

            // Buscamos si hay un iframe en la página
            const iframe = await page.$('iframe');
            if (iframe) {
                console.log('Iframe encontrado, buscando stream dentro...');
                const frame = await iframe.contentFrame();
                if (frame) {
                    // Si encontramos el iframe, también interceptamos sus peticiones
                    await frame.setRequestInterception(true);
                    frame.on('request', (request) => {
                        if (request.url().includes('.m3u8')) {
                            console.log('¡Stream .m3u8 encontrado DENTRO del iframe! ->', request.url());
                            resolve(request.url());
                        }
                        request.continue();
                    });
                }
            }
        });

        // Esperamos a que la promesa se resuelva, con un tiempo límite
        const foundStreamUrl = await Promise.race([
            streamUrlPromise,
            new Promise(resolve => setTimeout(() => resolve(null), 15000)) // 15 segundos de espera total
        ]);

        if (foundStreamUrl) {
            res.json({ streamUrl: foundStreamUrl });
        } else {
            console.log('No se encontró stream tras 15 segundos.');
            res.status(404).json({ error: 'No se pudo encontrar un stream .m3u8 en la página.' });
        }

    } catch (error) {
        console.error('Error durante el scraping:', error);
        res.status(500).json({ error: 'Ocurrió un error en el servidor al procesar la página.' });
    } finally {
        if (browser) {
            await browser.close();
            console.log('Navegador cerrado.');
        }
    }
});

app.listen(PORT, () => {
    console.log(`Servidor escuchando en el puerto ${PORT}`);
});
