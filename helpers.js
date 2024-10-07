function printProgress(progress) {
  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);
  process.stdout.write(progress);
}

module.exports = {
  downloadImage,
  printProgress,
};
