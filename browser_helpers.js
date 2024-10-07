const puppeteer = require('puppeteer');
const path = require('path');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const axios = require('axios');
const { downloadImage } = require('./helpers');

const startParsing = async (url, showProgress, sendFile) => {
  const { page, browser } = await createAndNavigateTo(url);

  const { newsId, siteLoginHash, mangaName } = await getRequiredData(page);

  const imageUrls = await getImages(page, newsId, siteLoginHash);

  const filePath = await createPDFFile(imageUrls, showProgress, mangaName);

  sendFile(filePath);

  await browser.close();
};

const createAndNavigateTo = async (url) => {
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: null,
    executablePath:
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  });
  const page = await browser.newPage();

  // Navigate to the site
  await page.goto(url, { waitUntil: 'networkidle0' });
  return { page, browser };
};

const getRequiredData = async (page) => {
  // Get the entire page content as a string
  const pageContent = await page.content();

  // Use a regex to find the site_login_hash directly from the HTML
  const match = pageContent.match(/var\s+site_login_hash\s*=\s*'([^']+)'/);
  const siteLoginHash = match ? match[1] : null;

  console.log('site_login_hash:', siteLoginHash);

  const newsId = await page.evaluate(() => {
    // Find the div with id="comics"
    const comicsDiv = document.querySelector('div#comics');
    // If the div exists, return the value of the data-news_id attribute
    return comicsDiv ? comicsDiv.getAttribute('data-news_id') : null;
  });

  console.log('data-news_id:', newsId);

  // get page's title 
  const title = await page.title();
  const mangaName = sanitizePath(title.split(' читати українською')[0]);

  return { newsId, siteLoginHash, mangaName };
};

const getImages = async (page, newsId, siteLoginHash) => {
  let imageUrls = [];

  try {
    const response = await axios.get(
      `https://manga.in.ua/engine/ajax/controller.php?mod=load_chapters_image&news_id=${newsId}&action=show&user_hash=${siteLoginHash}`
    );

    const htmlContent = response.data;
    // Extract the image sources from the response data
    imageUrls = await page.evaluate((html) => {
      // Create a temporary element to hold the HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;

      // Find all the img tags within the ul.xfieldimagegallery.loadcomicsimages
      const images = tempDiv.querySelectorAll(
        'ul.xfieldimagegallery.loadcomicsimages img'
      );
      const srcArray = [];

      // Extract the data-src attribute from each img
      images.forEach((img) => {
        const dataSrc = img.getAttribute('data-src');
        if (dataSrc) {
          srcArray.push(dataSrc);
        }
      });

      return srcArray;
    }, htmlContent);
  } catch (error) {
    console.error('Error fetching images:', error.message);
  }

  return imageUrls;
};

const createPDFFile = async (imageUrls, showProgress, mangaName) => {
  // Create a PDF document
  const doc = new PDFDocument();
  const pdfPath = path.join(__dirname, `${mangaName}.pdf`);
  doc.pipe(fs.createWriteStream(pdfPath));

  let current = 1;
  const total = imageUrls.length;
  const updateProgress = await showProgress();
  for (const url of imageUrls) {
    const imageBuffer = await downloadImage(url);

    // Add the image to the PDF, resizing it to fit within A5 dimensions
    const { width, height } = doc.page;
    doc.image(imageBuffer, 0, 0, {
      fit: [width, height],
      align: 'center',
      valign: 'center',
    });

    // update progress only every 2 seconds
    if (current % 5 === 0) {
      updateProgress(current, total);
    }

    current++;

    // Add a new page if not the last image
    if (current <= total) {
      doc.addPage({ size: 'A5', margin: 0 });
    }
  }
  updateProgress('DONE');

  // Finalize the PDF and end the stream
  doc.end();
  console.log(`\n\nPDF saved to ${pdfPath}`);

  // return path
  return pdfPath;
};

function sanitizePath(input) {
  // Define a regular expression for invalid path characters
  const invalidCharsRegex = /[<>:"\/\\|?*\0]/g;

  // Replace invalid characters with an empty string
  return input.replace(invalidCharsRegex, '');
}

module.exports = {
  createAndNavigateTo,
  getRequiredData,
  getImages,
  createPDFFile,
  startParsing,
};
