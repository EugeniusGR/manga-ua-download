const path = require('path');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const axios = require('axios');
const { getHeaders } = require('./helpers');
const { SocksProxyAgent } = require('socks-proxy-agent');
const jsdom = require('jsdom');
const { CookieJar } = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');
const { HttpsProxyAgent } = require('https-proxy-agent');

const proxyUrl = `http://${process.env.PROXY_USERNAME}:${process.env.PROXY_PASSWORD}@${process.env.PROXY_ADDRESS}:${process.env.PROXY_PORT}`;
const httpsAgent = new HttpsProxyAgent(proxyUrl);

const jar = new CookieJar();

const client = wrapper(
  axios.create({
    // httpsAgent,
    withCredentials: true,
    // proxy: {
    //   host: process.env.PROXY_ADDRESS,
    //   port: process.env.PROXY_PORT,
    //   auth: {
    //     username: process.env.PROXY_USERNAME,
    //     password: process.env.PROXY_PASSWORD,
    //   },
    //}
  })
);

const startParsingSelected = async (
  url,
  fromChapter,
  toChapter,
  showProgress,
  sendFile,
  sendError
) => {
  const { html } = await createAndNavigateTo(url, sendError);

  const options = await getRequiredDataFromChapters(html, sendError);

  const chaptersUrls = await getChaptersUrls(
    url,
    fromChapter,
    toChapter,
    options
  );

  console.log('chaptersUrls', chaptersUrls);
  for (let i = 0; i <= chaptersUrls.length - 1; i++) {
    await startParsing(
      chaptersUrls[i],
      showProgress,
      sendFile,
      sendError,
      true
    );
  }
};

const startParsing = async (
  url,
  showProgress,
  sendFile,
  sendError,
  ignoreLogs = false
) => {
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
    sendError,
    ignoreLogs
  );

  await sendFile(filePath);
};

const createAndNavigateTo = async (url, sendError) => {
  try {
    console.log('Starting parsing...');
    const res = await makeRequestWithCookies(url);
    console.log('Starting parsing...');
    const html = res;

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

const getRequiredDataFromChapters = async (pageContent, sendError) => {
  try {
    // Use a regex to find the site_login_hash directly from the HTML
    const match = pageContent.match(/var\s+site_login_hash\s*=\s*'([^']+)'/);
    const user_hash = match ? match[1] : null;

    // get attribute data-ratig-layer-id=
    const newsIdMatch = pageContent.match(/data-vote-num-id="(\d+)"/);
    const news_id = newsIdMatch ? newsIdMatch[1] : null;

    // get attribtue data-news_category=
    const newsCategory = pageContent.match(/data-news_category="([^"]+)"/);
    const news_category = newsCategory ? newsCategory[1] : null;

    return { news_id, user_hash, news_category };
  } catch (error) {
    console.error('Error getting required data:', error.message);
    sendError(error.message);
  }
};

const getImages = async (newsId, siteLoginHash, sendError) => {
  let imageUrls = [];

  const url = `https://manga.in.ua/engine/ajax/controller.php?mod=load_chapters_image&news_id=${newsId}&action=show&user_hash=${siteLoginHash}`;

  try {
    const response = await makeRequestWithCookies(url);

    const htmlContent = response;

    const imageUrls = htmlContent
      .match(/data-src="([^"]+)"/g)
      .map((src) => src.match(/data-src="([^"]+)"/)[1]);

    return imageUrls.filter(
      (url) => !url.includes('noimage.jpg') && !url.includes('_vizytka.png')
    );
  } catch (error) {
    console.error('Error fetching images:', error.message);
    sendError(error.message);
  }

  return imageUrls;
};

const createPDFFile = async (
  imageUrls,
  showProgress,
  mangaName,
  sendError,
  ignoreLogs
) => {
  try {
    // Create a PDF document
    const doc = new PDFDocument({
      size: 'A5',
      margin: 0,
    });
    const pdfPath = path.join(__dirname, `${mangaName}.pdf`);
    doc.pipe(fs.createWriteStream(pdfPath));

    let current = 1;
    const total = imageUrls.length;
    let updateProgress;
    if (!ignoreLogs) {
      updateProgress = await showProgress();
    }

    doc
      .fontSize(28)
      .font('fonts/Play.ttf')
      .text(mangaName.split('-')[0], 0, 200, {
        align: 'center',
      })
      .fontSize(28)
      .font('fonts/Play.ttf')
      .text(mangaName.split('-')[1], 0, 250, {
        align: 'center',
      })
      .fontSize(20)
      .font('fonts/Play.ttf')
      .text(mangaName.split('-')[2], 0, 300, {
        align: 'center',
      });

    doc.addPage({ size: 'A5', margin: 0 });
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
      if (current % 5 === 0 && !ignoreLogs) {
        updateProgress(current, total);
      }

      current++;

      // Add a new page if not the last image
      if (current <= total) {
        doc.addPage({ size: 'A5', margin: 0 });
      }
    }

    if (!ignoreLogs) {
      updateProgress('DONE');
    }

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
  const response = await makeRequestWithCookies(url, {}, 'arraybuffer');

  return response;
}

const getChaptersUrls = async (url, fromChapter, toChapter, settings) => {
  try {
    console.log('settings', settings);

    const formData = new FormData();
    formData.append('news_id', settings.news_id);
    formData.append('user_hash', settings.user_hash);
    formData.append('news_category', settings.news_category);
    formData.append('action', 'show');
    formData.append('this_link', '');

    const headers = {
      ...getHeaders({ refer: url }),
      'Content-Type': 'multipart/form-data',
    };

    const cookieHeader = getCookies(url);
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }

    const res = await client.post(
      'https://manga.in.ua/engine/ajax/controller.php?mod=load_chapters',
      formData,
      {
        headers,
      }
    );
    setCookies(url, res.headers);
    const html = res.data;

    // save file
    const dom = await new jsdom.JSDOM(res.data);

    const document = dom.window.document;

    const chapterUrls = document.querySelectorAll('.ltcitems a');

    const chapterUrlsArray = Array.from(chapterUrls);
    console.log(
      'chapterUrls:',
      chapterUrlsArray.map((link) => link.href)
    );

    // crop the array to the selected chapters
    const selectedChapters = chapterUrlsArray.slice(fromChapter - 1, toChapter);

    console.log(
      'selectedChapters:',
      selectedChapters.map((link) => link.href)
    );

    return selectedChapters.map((link) => link.href);
  } catch (error) {
    console.error('Error fetching page:', error.message);
    sendError(error.message);
  }
};

// Function to set cookies into the jar from the response headers
function setCookies(url, headers) {
  if (headers['set-cookie']) {
    headers['set-cookie'].forEach((cookie) => {
      jar.setCookieSync(cookie, url);
    });
  }
}

function getCookies(url) {
  return jar.getCookieStringSync(url);
}

// Function to make a request with cookies and custom proxy
async function makeRequestWithCookies(
  url,
  headersProp = {},
  responseType = 'json'
) {
  try {
    const headers = {
      ...getHeaders({ refer: url }),
      'Content-Type': 'multipart/form-data',
      ...headersProp,
    };
    // Get cookies from the jar
    const cookieHeader = getCookies(url);
    if (cookieHeader) {
      headers['Cookie'] = cookieHeader;
    }

    const response = await client
      .get(url, {
        headers,
        responseType,
        timeout: 10000,
      })
      .catch((error) => {
        console.error('Request failed:', error);
        throw error;
      });
    // save img

    if (responseType === 'json') {
      // Update the jar with any new cookies from the response
      setCookies(url, response.headers);
    }

    return response.data;
  } catch (error) {
    console.error('Request failed:', error.message);
    throw error;
  }
}

module.exports = {
  createAndNavigateTo,
  getRequiredData,
  getImages,
  createPDFFile,
  startParsing,
  startParsingSelected,
};
