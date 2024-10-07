const puppeteer = require('puppeteer');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const axios = require('axios');
const path = require('path'); 

// Get the URL from command-line arguments
const args = process.argv.slice(2);
console.log('args', args)
const urlFlag = args.find(arg => arg.startsWith('--link='));
const url = urlFlag ? urlFlag.split('=')[1] : null;

if (!url) {
    console.error('Please provide a URL using the --link flag.');
    process.exit(1);
}

(async () => {
    // Launch the Puppeteer browser
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    page.setViewport({
        width: 640,
        height: 2000,
        deviceScaleFactor: 1,
      })

    // Navigate to the site
    await page.goto(url);

    await page.click('#startloadingcomicsbuttom > a')

    await page.waitForFunction(() => {
        const element = document.querySelector('.messbloks-info');
        return element && getComputedStyle(element).display !== 'none';
    });

    // Scroll to the bottom of the page
    await autoScroll(page);

    await page.waitForFunction(() => {
        const images = Array.from(document.querySelectorAll('#comics li img'));
        return images.every(img => img.classList.contains('lazy-loaded'));
    });

    // Extract image URLs
    const imageUrls = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('#comics li img')).map(el => el.src).filter((el) => {
            return !el.includes('_zastavka.png')
        });
    });

    console.log('Image URLs:', imageUrls);

    // Create a PDF document
    const doc = new PDFDocument();
    const pdfPath = path.join(__dirname, 'images.pdf');
    doc.pipe(fs.createWriteStream(pdfPath));
    // Download and add images to PDF
    // for (const url of slicedArray) {
    //     const imageBuffer = Buffer.from(url, 'base64');
    //     console.log('imageBuffer', imageBuffer)
    //     doc.image(imageBuffer, 0, 0, {fit: [250, 300]});
    //     doc.addPage();
    // }
    // for (const base64 of imageUrls) {
    //     // Check if the base64 string is valid and contains an image type
    //     if (base64.startsWith('data:image/')) {
    //         const base64Data = base64.split(',')[1]; // Split to get the base64 content
    //         const imageBuffer = Buffer.from(base64Data, 'base64'); // Convert Base64 to Buffer
    
    //         // Add the image to the PDF
    //         doc.image(imageBuffer, 250, 250, { fit: [500, 500], align: 'center', valign: 'center' });
    //         doc.addPage(); // Add a new page for the next image
    //     } else {
    //         console.warn('Not a valid Base64 image:', base64);
    //     }
    // }
    for (const url of imageUrls) {
        const imageBuffer = await downloadImage(url);
        console.log('imageBuffer', imageBuffer)
        doc.image(imageBuffer, 0, 0)
        doc.addPage();
    }

    // Finalize the PDF and end the stream
    doc.end();
    console.log(`PDF saved to ${pdfPath}`);

    // Close the browser
    await browser.close();
})();

// Function to scroll to the bottom of the page
async function autoScroll(page) {
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 900;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if (totalHeight >= scrollHeight) {
                    clearInterval(timer);
                    resolve();
                }
            }, 500);
        });
    });
}


// Function to download an image and return its buffer
async function downloadImage(url) {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return response.data;
}