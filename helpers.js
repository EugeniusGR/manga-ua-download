function printProgress(progress) {
  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);
  process.stdout.write(progress);
}

const getHeaders = ({refer = ''}) => {
  const headers = {
    "accept": "text/html, */*; q=0.01",
    "accept-language": "en-US,en;q=0.9,uk;q=0.8",
    "priority": "u=1, i",
    "sec-ch-ua": "\"Google Chrome\";v=\"129\", \"Not=A?Brand\";v=\"8\", \"Chromium\";v=\"129\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"macOS\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "x-requested-with": "XMLHttpRequest",
    // "cookie": "X_CACHE_KEY=c92d9cd5f91cdce3a4d8596caed3bcdc; PHPSESSID=pu8h9l7hh2d0ftvun2hram50q2; _gid=GA1.3.1959732061.1728297182; lastchapp=3551|1|1,3977|1|1; _gat_gtag_UA_43267867_3=1; cf_clearance=Vu_uQH.BDuw_TgVIegcuK7qldBI9sFks.ToZCPgaRq0-1728310759-1.2.1.1-HdMaqGT.mIU8pds.9xdVhKKxNnTWxFNq2g.36B.GpHQCuud3Uld5453roX5r6s56Oidpoj_UgAIYjsuQeZkyts4.EtljUJfX.8KEmBdaG0VGPVyYgWVe5n1O0xGGR70wdMin2K.VBGGU1t8yesoGU9AybhH1tq6aFM8DImu9lppMh1XWXW4EPbgifR1Ab_5WJDW7XGen6t8CS2fd06Mzi_4Sn3hv3wnLh7pWEVbTCR0REIklBaAHBZa11M8lCAWPPCch4RvizZnVygP_kxt6EZM_WKCRZG7LAGC.qMSukP0TlD71k45SdN1PDJuQ5PCYTxTvTO47j7gyMUZFvhNDr2REW2Zy_fZTqIrFL.W.4zNYi0whClU0hOjQxW6RV_T9d2.DaeDoE57l619w0Bo6cw; _ga_Y22HTEKJL6=GS1.1.1728310120.4.1.1728310759.0.0.0; _ga=GA1.1.2070223762.1728297182",
    "Referer": refer,
    "Referrer-Policy": "strict-origin-when-cross-origin",
    //'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  };

  return headers;
}


module.exports = {
  printProgress,
  getHeaders,
};
