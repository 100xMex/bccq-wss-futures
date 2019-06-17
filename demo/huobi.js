const FuturesHuobi = require('../lib/futures_huobi');

const config = {
  key: '',
  secret: '',
  wskey: '',
  wssecret: '',
  passphrase: '',
  urlHost: 'https://api.hbdm.com',
  websocekHost: 'wss://www.hbdm.com/ws',
};
const futuresInstrumentId = 'BTC_CW';
const channels = [
  // `futures/depth:${futuresInstrumentId}`,
  // `futures/depth5:${futuresInstrumentId}`,
  // `futures/ticker:${futuresInstrumentId}`,
  // `futures/trade:${futuresInstrumentId}`,
  // `futures/estimated_price:${futuresInstrumentId}`,
  // `futures/price_range:${futuresInstrumentId}`,
  // `futures/mark_price:${futuresInstrumentId}`,
  // `market.${futuresInstrumentId}.detail`,
  'market.BTC_CW.kline.1min',
  'market.BTC_CW.depth.step6',
  'market.BTC_CW.detail',
  'market.BTC_CW.trade.detail',
  'orders.BTC_CW',
];
const futuresHuobi = new FuturesHuobi(futuresInstrumentId, config);
futuresHuobi.subscribe(channels);

// futuresHuobi.on('orderbook5', () => {
//   console.log('Ask %j Bid %j', futuresHuobi.orderbook5.asks[0], futuresHuobi.orderbook5.bids[0]);
// });
// futuresHuobi.on('price', () => {
//   console.log('Prices Estimated %s Mark %s Range %j',
//     futuresHuobi.priceEstimated || '--', futuresHuobi.priceMark, futuresHuobi.priceRange);
// });
// futuresHuobi.on('ticker', () => {
//   console.log('Ticker %j', futuresHuobi.ticker);
// });
// futuresHuobi.on('trade', () => {
//   console.log('Trade %j', futuresHuobi.lastTrade);
// });
