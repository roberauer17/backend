const express = require('express');
const cors = require('cors');
const puppeteer = require('puppeteer');

// --- HUELLA DIGITAL ---
console.log("--- Running Detective Paranoico v4 ---");

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
    let responseSent = false; // Flag para asegurarnos de que solo enviamos una respuesta

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

        // Creamos un temporizador. Si en 25 segundos no hemos enviado respuesta, fallamos.
        const timeout = setTimeout(() => {
            if (!responseSent) {
                console.log('Tiempo de espera agotado.');
                res.status(404).json({ error: 'No se pudo encontrar un stream en el tiempo límite.' });
                responseSent = true;
            }
        }, 25000);

        const findStreamAndRespond = (request) => {
            // Si encontramos el stream Y NO hemos enviado ya la respuesta...
            if (request.url().includes('.m3u8') && !responseSent) {
                console.log('¡Stream .m3u8 encontrado! ->', request.url());
                responseSent = true; // Marcamos que ya hemos respondido
                clearTimeout(timeout); // Cancelamos el temporizador
                
                // ¡LA CLAVE ESTÁ AQUÍ! Enviamos la respuesta inmediatamente.
                res.json({ streamUrl: request.url() });
                
                // Intentamos que el resto del código no siga ejecutándose, pero no es crítico.
                page.removeListener('request', findStreamAndRespond);
            }
            // Si no es el stream, la petición continúa normalmente.
            else if (!request.isInterceptResolutionHandled()) {
                 request.continue();
            }
        };

        page.on('request', findStreamAndRespond);
        await page.setRequestInterception(true);
        await page.goto(urlToScrape, { waitUntil: 'networkidle2', timeout: 60000 });

        const iframe = await page.$('iframe');
        if (iframe) {
            console.log('Iframe encontrado, buscando stream dentro...');
            const frame = await iframe.contentFrame();
            if (frame) {
                frame.on('request', findStreamAndRespond);
                await frame.setRequestInterception(true);
            }
        }

    } catch (error) {
        console.error('Error durante el scraping:', error.message);
        if (!responseSent) {
            res.status(500).json({ error: `Ocurrió un error en el servidor: ${error.message}` });
            responseSent = true;
        }
    } finally {
        if (browser) {
            // Esperamos un poco antes de cerrar para asegurar que la respuesta se envíe
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
