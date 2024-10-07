const axios = require('axios');

async function downloadImage(url) {
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  return response.data;
}

function printProgress(progress) {
  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);
  process.stdout.write(progress);
}

module.exports = {
  downloadImage,
  printProgress,
};