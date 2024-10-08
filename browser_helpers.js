const path = require('path');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const axios = require('axios');
const { headers } = require('./helpers');
const { SocksProxyAgent } = require('socks-proxy-agent');

const proxyOptions = `socks5://${process.env.PROXY_USERNAME}:${process.env.PROXY_PASSWORD}@${process.env.PROXY_ADDRESS}:${process.env.PROXY_PORT}`;
const httpsAgent = new SocksProxyAgent(proxyOptions);

axios.defaults.withCredentials = true;

const client = 
  axios.create({
    httpAgent: httpsAgent,
  })

const startParsing = async (url, showProgress, sendFile, sendError) => {
  
  const { html } = await createAndNavigateTo(url, sendError);

  const { newsId, siteLoginHash, mangaName } = await getRequiredData(
    html,
    sendError
  );

  const imageUrls = await getImages(newsId, siteLoginHash, sendError);

  const filePath = await createPDFFile(
    imageUrls,
    showProgress,
    mangaName,
    sendError
  );

  sendFile(filePath);
};

const createAndNavigateTo = async (url, sendError) => {
  try {
    console.log('Starting parsing...');
    const res = await client.get(url, {
      headers: headers,
    });
    console.log('Starting parsing...');
    const html = res.data;

    return { html };
  } catch (error) {
    console.error('Error fetching page:', error.message);
    sendError(error.message);
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

const getImages = async (newsId, siteLoginHash, sendError) => {
  let imageUrls = [];

  try {
    const response = await client.get(
      `https://manga.in.ua/engine/ajax/controller.php?mod=load_chapters_image&news_id=${newsId}&action=show&user_hash=${siteLoginHash}`,
      {
        headers: headers,
      }
    );

    const htmlContent = response.data;

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

const createPDFFile = async (imageUrls, showProgress, mangaName, sendError) => {
  try {
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

async function downloadImage(url) {
  const response = await client.get(url, {
    responseType: 'arraybuffer',
    headers: headers,
  });
  return response.data;
}

module.exports = {
  createAndNavigateTo,
  getRequiredData,
  getImages,
  createPDFFile,
  startParsing,
};
