const path = require('path');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const { headers } = require('./helpers');
const puppeteer = require('puppeteer');
require('dotenv').config();

const startParsing = async (url, showProgress, sendFile, sendError) => {
  
  const { html, page } = await createAndNavigateTo(url, sendError);

  const { newsId, siteLoginHash, mangaName } = await getRequiredData(
    html,
    sendError,
  );

  const imageUrls = await getImages(newsId, siteLoginHash, sendError, page);

  const filePath = await createPDFFile(
    imageUrls,
    showProgress,
    mangaName,
    sendError,
    page
  );

  sendFile(filePath);
};

const createAndNavigateTo = async (url, sendError) => {
  
  try {
    const browser = await puppeteer.launch({
      executablePath: process.env.NODE_ENV === 'production' ? process.env.EXECUTABLE_PATH : puppeteer.executablePath(),
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--single-process', '--no-zygote'],
    });
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      ...headers, // add any custom headers you have here
    });
    await page.goto(url, { waitUntil: 'networkidle0' });

    const res = await page.content();

    return { html: res, page };
  } catch (error) {
    console.error('Error fetching page:', error.message);
    sendError(error);
  }
};

const getRequiredData = async (pageContent, sendError) => {
  try {
    // Use a regex to find the site_login_hash directly from the HTML
    const match = pageContent.match(/var\s+site_login_hash\s*=\s*'([^']+)'/);
    const siteLoginHash = match ? match[1] : null;

    console.log('site_login_hash:', siteLoginHash);

    // find the 'data-news_id= in html and get the value
    const newsIdMatch = pageContent.match(
      /<a[^>]*href="javascript:AddComplaint\('(\d+)', 'news'\)">/
    );
    const newsId = newsIdMatch ? newsIdMatch[1] : null;

    console.log('data-news_id:', newsId);

    // get page's title
    const title = pageContent.match(/<title>(.*?)<\/title>/)[1];
    const mangaName = sanitizePath(title.split(' читати українською')[0]);
    console.log('mangaName', mangaName);

    return { newsId, siteLoginHash, mangaName };
  } catch (error) {
    console.error('Error getting required data:', error.message);
    sendError(error.message);
  }
};

const getImages = async (newsId, siteLoginHash, sendError, page) => {
  let imageUrls = [];

  try {
    await page.goto(`https://manga.in.ua/engine/ajax/controller.php?mod=load_chapters_image&news_id=${newsId}&action=show&user_hash=${siteLoginHash}`)
    const response = await page.content();
    const htmlContent = response;

    const imageUrls = htmlContent
      .match(/data-src="([^"]+)"/g)
      .map((src) => src.match(/data-src="([^"]+)"/)[1]);

    return imageUrls;
  } catch (error) {
    console.error('Error fetching images:', error.message);
    sendError(error.message);
  }

  return imageUrls;
};

const createPDFFile = async (imageUrls, showProgress, mangaName, sendError, page) => {
  try {
    // Create a PDF document
    const doc = new PDFDocument();
    const pdfPath = path.join(__dirname, `${mangaName}.pdf`);
    doc.pipe(fs.createWriteStream(pdfPath));

    let current = 1;
    const total = imageUrls.length;
    const updateProgress = await showProgress();
    for (const url of imageUrls) {
      const imageBuffer = await downloadImage(url, page);

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
  } catch (error) {
    console.error('Error creating PDF:', error.message);
    sendError(error.message);
  }
};

function sanitizePath(input) {
  // Define a regular expression for invalid path characters
  const invalidCharsRegex = /[<>:"\/\\|?*\0]/g;

  // Replace invalid characters with an empty string
  return input.replace(invalidCharsRegex, '');
}

async function downloadImage(url, page) {
  const response = await page.goto(url, { waitUntil: 'networkidle0' });

  const imageBuffer = await response.buffer();

  return imageBuffer;
}

module.exports = {
  createAndNavigateTo,
  getRequiredData,
  getImages,
  createPDFFile,
  startParsing,
};
