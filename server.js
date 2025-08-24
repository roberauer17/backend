const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');

// --- HUELLA DIGITAL ---
console.log("--- Running Detective Profesional v3 ---");

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
        
        const streamUrl = await new Promise(async (resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Tiempo de espera agotado. No se encontró el stream.'));
            }, 25000);

            const findStream = (request) => {
                if (request.url().includes('.m3u8')) {
                    console.log('¡Stream .m3u8 encontrado! ->', request.url());
                    clearTimeout(timeout);
                    resolve(request.url());
                } else {
                    request.continue();
                }
            };

            page.on('request', findStream);
            await page.setRequestInterception(true);

            await page.goto(urlToScrape, { waitUntil: 'networkidle2', timeout: 60000 });

            const iframe = await page.$('iframe');
            if (iframe) {
                console.log('Iframe encontrado, buscando stream dentro...');
                const frame = await iframe.contentFrame();
                if (frame) {
                    frame.on('request', findStream);
                    await frame.setRequestInterception(true);
                }
            }
        });

        if (streamUrl) {
            res.json({ streamUrl: streamUrl });
        } else {
            res.status(404).json({ error: 'No se pudo encontrar un stream .m3u8 en la página.' });
        }

    } catch (error) {
        console.error('Error durante el scraping:', error.message);
        res.status(500).json({ error: `Ocurrió un error en el servidor: ${error.message}` });
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
