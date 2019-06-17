const BN = require('bignumber.js');

const { COIN_NAME, DATE, LEVEL, FEE, configHuobi, configOkex, } = require('./quant_config');

const FuturesHuobi = require('../lib/futures_huobi');
const FuturesOkex = require('../lib/futures_okex');

let okPrices = { ask: null, bid: null };
let huobiPrices = { ask: null, bid: null };

const syncOkex = () => {
  const futuresInstrumentId = `${COIN_NAME}-USD-${DATE.OKEx}`;

  const futuresOkex = new FuturesOkex(futuresInstrumentId, configOkex);
  futuresOkex.subscribe();

  futuresOkex.on('orderbook5', () => {
    // console.log('Ask %j Bid %j', futuresOkex.orderbook5.asks[0], futuresOkex.orderbook5.bids[0]);
    okPrices = futuresOkex.getAsk1Bid1(LEVEL);
  });
};

const syncHuobi = () => {
  const futuresInstrumentId = `${COIN_NAME}_${DATE.HuoBi}`;

  const channels = [
    // `futures/depth:${futuresInstrumentId}`,
    // `futures/depth5:${futuresInstrumentId}`,
    // `futures/ticker:${futuresInstrumentId}`,
    // `futures/trade:${futuresInstrumentId}`,
    // `futures/estimated_price:${futuresInstrumentId}`,
    // `futures/price_range:${futuresInstrumentId}`,
    // `futures/mark_price:${futuresInstrumentId}`,
    // `market.${futuresInstrumentId}.detail`,
    `market.${futuresInstrumentId}.kline.1min`,
    `market.${futuresInstrumentId}.depth.step6`,
    `market.${futuresInstrumentId}.detail`,
    `market.${futuresInstrumentId}.trade.detail`,
    `orders.${futuresInstrumentId}`,
  ];
  const futuresHuobi = new FuturesHuobi(futuresInstrumentId, configHuobi);
  futuresHuobi.subscribe(channels);

  futuresHuobi.on('orderbook5', () => {
    // console.log('Ask %j Bid %j', futuresHuobi.orderbook5.asks[0], futuresHuobi.orderbook5.bids[0]);
    huobiPrices = futuresHuobi.getAsk1Bid1(LEVEL);
  });
};

const printDebug = () => {
  console.log('\n%s', new Date());
  console.log(huobiPrices);
  console.log(okPrices);
};

const calcAskBidPercent = (ask, bid, slippage = 1) => {
  // TODO 精算手续费, 加一个滑点
  const fee = new BN(FEE).times(slippage * 2 * 2); // *2 表示两个交易所开仓一买一卖, *2 表示两个交易所平仓时一买一卖
  const delta = new BN(ask.minus(bid).div(bid).toFixed(4));
  console.log('价差 %s, 手续费 %s', delta, fee);

  if ((delta.gt(0) && fee.lt(delta)) || (delta.lt(0) && fee.times(-1).gt(delta))) {
    console.log('==== 可套利 手续费 %s, 价差 %s, 利润 %s, 头寸 %s', fee, delta);
    return true;
  }
  return false;
};

syncHuobi();
syncOkex();

setInterval(() => {
  if (!huobiPrices.ask || !huobiPrices.bid || !okPrices.ask || !okPrices.bid) return;

  const huobiPrice = [new BN(huobiPrices.ask[0]), new BN(huobiPrices.bid[0])];
  const okPrice = [new BN(okPrices.ask[0]), new BN(okPrices.bid[0])];

  let arbitrateEnable = false;
  if (huobiPrice[0].lt(okPrice[1])) {
    // 火币卖 2 小于 OK 买 2 => 火币买 OK卖
    printDebug();
    const cont = Math.min(parseInt(okPrices.bid[1], 10), parseInt(okPrices.ask[1], 10));
    arbitrateEnable = calcAskBidPercent(okPrice[1], huobiPrice[0]);
    if (arbitrateEnable) {
      console.log('火币 %s 买 OK %s 卖, %s 张', huobiPrice[0], okPrice[1], cont);
    }
  } else if (okPrice[0].lt(huobiPrice[1])) {
    // OK卖 2 小于火币买 2 => OK 买火币卖
    printDebug();
    const cont = Math.min(parseInt(okPrices.ask[1], 10), parseInt(okPrices.bid[1], 10));
    arbitrateEnable = calcAskBidPercent(okPrice[0], huobiPrice[1]);
    if (arbitrateEnable) {
      console.log('火币 %s 卖, OK %s 买, %s 张', huobiPrice[1], okPrice[0], cont);
    }
  } else {
    console.log('无套利机会');
  }

  // TODO 下单, 仓位获取, 控制不爆仓
}, 1e3);
