const EventEmitter = require('events');
const { PublicClient, V3WebsocketClient, AuthenticatedClient } = require('../package/huobi-node');

class FuturesHuobi extends EventEmitter {
  constructor(instrumentId, config) {
    super();

    this.instrumentId = instrumentId;
    this.config = config;
    this.init();

    this.ticker = {
      high: '',
      low: '',
      volume: '',
      info: {
        id: 0,
        mrid: 0,
        open: 0,
        close: 0,
        high: 0,
        low: 0,
        amount: 0,
        vol: 0,
        count: 0,
      },
    };
    this.lastTrade = {
      side: '',
      qty: '',
      price: '',
      info: {
        instrument_id: '', // 合约名称
        price: '', // 成交价格
        qty: '', // 成交数量
        side: '', // buy or sell
        timestamp: '', // 系统时间戳
        trade_id: '', // 成交id}
      },
    };
    this.estimatedPrice = ''; // 预估交割价格
    this.priceRange = { maxBid: '', minAsk: '' }; // 限制下单价格区间
    this.markPrice = ''; // 标记价格
    this.orderbook5 = { asks: [], bids: [] };
  }

  init() {
    // this.pClient = new PublicClient(this.config.urlHost);
    // this.authClient = new AuthenticatedClient(
    //   this.config.httpkey,
    //   this.config.httpsecret,
    //   this.config.passphrase,
    //   this.config.urlHost,
    // );
    this.wss = new V3WebsocketClient(this.config.websocekHost);
  }

  subscribe(channels) {
    // websocket 初始化
    this.wss.connect();
    this.wss.on('open', (err) => {
      console.log('websocket open!!! %s', err ? `Error: ${err && err.message}` : 'Success');

      channels.forEach(channel => this.wss.subscribe(channel));

      // this.wss.login(this.config.wskey, this.config.wssecret, this.config.passphrase);
    });

    // websocket 返回消息
    this.wss.on('message', (data) => {
      // console.log('!!! websocket message %j', data);
      const obj = JSON.parse(data);
      if (obj['err-code'] !== undefined) {
        console.log('error subscript %s', data);
        return;
      }

      if (obj.subbed) {
        // 订阅
        this.onSubscribe(obj);
        return;
      }

      if (obj.ch) {
        // 推送数据
        this.onSubscribedData(obj);
        return;
      }

      switch (obj.op) {
        case 'auth':
          // 登录消息
          this.onLogin(obj);
          break;
        case 'close':
          // 取消订阅
          this.onUnsubscribe(obj);
          break;
        case 'error':
          // 取消订阅
          this.onUnsubscribe(obj);
          break;
        default:
          break;
      }
    });
  }

  onLogin(data) {
    console.log('%s Login Success %j', this.instrumentId, data);

    // 订阅一些私有频道
    // wss.subscribe(`swap/account:${swapInstrumentId}`);
    // wss.unsubscribe(`swap/position:${swapInstrumentId}`);
  }

  onSubscribe(data) {
    console.log('%s Subscribe %j', this.instrumentId, data);
  }

  onUnsubscribe(data) {
    console.log('%s Unsubscribe %j', this.instrumentId, data);
  }

  onSubscribedData(data) {
    if (!data.tick) {
      console.log('recv error message $j', data);
      return;
    }

    const table = data.ch.replace(new RegExp(`\\.${this.instrumentId}.?`), '/')
      .split('.')[0]
      .replace('market', 'futures');

    // console.log('Subscribed %s Data: %j', table, data.tick);

    // this.handleDepth5Data(data.tick);
    switch (table) {
      // / 公有
      case 'futures/detail': // 行情数据频道
        // console.log('Ticker %j', data.tick);
        this.ticker = {
          high: data.tick.high,
          low: data.tick.low,
          volume: data.tick.vol,
          info: data.tick,
        };
        this.emit('ticker');
        break;
      case 'futures/trade': // 交易信息频道
        // console.log('Trides %j', data.tick.data[0]);
        this.lastTrade = {
          side: data.tick.data[0].direction,
          qty: data.tick.data[0].amount,
          price: data.tick.data[0].price,
          info: data.tick.data[0],
        };
        this.emit('trade');
        break;
      case 'futures/depth': // 深度数据频道，首次200档，后续增量
        this.handleDepth5Data('', data.tick);
        break;
      case 'futures/depth5': // 深度数据频道，每次返回前5档
        this.handleDepth5Data('', data.tick);
        break;
      // case 'futures/estimated_price': // 获取预估交割价
      //   console.log('Estimated Price %j', data.tick);
      //   this.estimatedPrice = data.tick.settlement_price;
      //   this.emit('estimated_price');
      //   break;
      // case 'futures/price_range': // 限价范围频道
      //   console.log('Price Range %j', data.tick);
      //   this.priceRange = { maxBid: data.tick.highest, minAsk: data.tick.lowest };
      //   this.emit('price_range');
      //   break;
      // case 'futures/mark_price': // 标记价格频道
      //   console.log('Mark Price %j', data.tick);
      //   this.markPrice = data.tick.mark_price;
      //   this.emit('mark_price');
      //   break;
      // / 私有
      // case 'futures/account': // 用户账户信息频道
      //   break;
      // case 'futures/position': // 用户持仓信息频道
      //   break;
      case 'orders/': // 用户交易数据频道
        break;
      default: // 各种 k 线
        // futures/kline
        break;
    }
  }

  handleDepthData(instrumentId, publicData) {
    // 行情数据
    // table, action, data[0]: {instrument_id, asks, bids, timestamp, checksum}

    const asks = publicData.asks || []; // [价格,张数,爆仓单张数,深度由几笔订单构成]
    const bids = publicData.bids || [];
    // console.log('卖单更新: %j', asks);
    // console.log('买单更新: %j', bids);

    // TODO 自己合成 OrderBook
    // if (publicData.action === 'partial') {
    // } else if (publicData.action === 'update') {
    // }

    // asks.map(ask => {
    //   const price = ask[0];
    //   this.orderbook.asks[price] = ask;
    // });
    this.emit('orderbook');
  }

  handleDepth5Data(instrumentId, publicData) {
    // 5 档行情数据
    // table, action, data[0]: {instrument_id, asks, bids, timestamp, checksum}

    const asks = publicData.asks || []; // [价格,张数,爆仓单张数,深度由几笔订单构成]
    const bids = publicData.bids || [];
    this.orderbook5 = { asks, bids };
    this.emit('orderbook5');
  }

  getAsk1Bid1(level = 1) {
    const idx = level - 1;
    if (this.orderbook5 && this.orderbook5.asks && this.orderbook5.bids) {
      const ask = this.orderbook5.asks[idx];
      const bid = this.orderbook5.bids[idx];
      return { ask: [`${ask[0]}`, `${ask[1]}`], bid: [`${bid[0]}`, `${bid[1]}`] };
    }
    return { ask: null, bid: null };
  }
}

module.exports = FuturesHuobi;
