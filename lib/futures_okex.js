const EventEmitter = require('events');
const { PublicClient, V3WebsocketClient, AuthenticatedClient } = require('@okfe/okex-node');

class FuturesOkex extends EventEmitter {
  constructor(instrumentId, config, channels = {}) {
    super();

    this.instrumentId = instrumentId;
    this.config = config;
    this.publicChannels = channels.publicChannels || [
      `futures/depth:${instrumentId}`,
      `futures/depth5:${instrumentId}`,
      `futures/ticker:${instrumentId}`,
      `futures/trade:${instrumentId}`,
      `futures/estimated_price:${instrumentId}`,
      `futures/price_range:${instrumentId}`,
      `futures/mark_price:${instrumentId}`,
    ];
    this.privateChannels = channels.privateChannels || [
      `futures/account:${instrumentId.split('-')[0]}`,
      `futures/position:${instrumentId}`,
      `futures/order:${instrumentId}`,
    ];
    this.init();

    this.ticker = {
      high: '',
      low: '',
      volume: '',
      info: {
        best_ask: '', // 卖一价
        best_bid: '', // 买一价
        high_24h: '', // 24小时最高价
        instrument_id: '', // 合约名称
        last: '', // 最新成交价
        low_24h: '', // 24小时最低价
        timestamp: '', // 系统时间戳
        volume_24h: '', // 24小时成交量
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
    this.priceEstimated = ''; // 预估交割价格
    this.priceRange = { maxBid: '', minAsk: '' }; // 限制下单价格区间
    this.priceMark = ''; // 标记价格
    this.orderbook = { asks: [], bids: [] };
    this.orderbook5 = { asks: [], bids: [] };
  }

  init() {
    this.pClient = new PublicClient(this.config.urlHost);
    this.authClient = new AuthenticatedClient(
      this.config.httpkey,
      this.config.httpsecret,
      this.config.passphrase,
      this.config.urlHost,
    );
    this.wss = new V3WebsocketClient(this.config.websocekHost);
  }

  subscribe() {
    // websocket 初始化
    this.wss.connect();
    this.wss.on('open', (err) => {
      console.log('websocket open!!! %s', err ? `Error: ${err && err.message}` : 'Success');

      this.publicChannels.forEach(channel => this.wss.subscribe(channel));

      this.wss.login(this.config.wskey, this.config.wssecret, this.config.passphrase);
    });

    // websocket 返回消息
    this.wss.on('message', (data) => {
      // console.log(`!!! websocket message =${data}`);
      const obj = JSON.parse(data);
      switch (obj.event) {
        case 'login':
          // 登录消息
          if (obj.success !== true) {
            console.log('Login Failed');
            return;
          }
          this.onLogin(obj);
          break;
        case 'subscribe':
          // 订阅
          this.onSubscribe(obj);
          break;
        case 'unsubscribe':
          // 取消订阅
          this.onUnsubscribe(obj);
          break;
        default:
          // 订阅的数据
          this.onSubscribedData(obj);
          break;
      }
    });
  }

  onLogin(data) {
    console.log('%s Login Success %j', this.instrumentId, data);

    // 订阅一些私有频道
    this.privateChannels.forEach(channel => this.wss.subscribe(channel));
  }

  onSubscribe(data) {
    console.log('%s Subscribe %j', this.instrumentId, data);
  }

  onUnsubscribe(data) {
    console.log('%s Unsubscribe %j', this.instrumentId, data);
  }

  onSubscribedData(data) {
    if (data.event === 'error') {
      console.log('recv error message %j', data);
      return;
    }

    const recvData = data.data && data.data[0];
    if (!data.table || !recvData) return;
    // console.log('Subscribed %s Data:', data.table, recvData);

    switch (data.table) {
      // / 公有
      case 'futures/ticker': // 行情数据频道
        this.handleTicker(recvData);
        break;
      case 'futures/trade': // 交易信息频道
        this.handleTrade(recvData);
        break;
      case 'futures/depth': // 深度数据频道，首次200档，后续增量
        this.handleDepthData(recvData);
        break;
      case 'futures/depth5': // 深度数据频道，每次返回前5档
        this.handleDepth5Data(recvData);
        break;
      case 'futures/estimated_price': // 获取预估交割价
        this.handlePrice(recvData, 'estimated');
        break;
      case 'futures/price_range': // 限价范围频道
        this.handlePrice(recvData, 'range');
        break;
      case 'futures/mark_price': // 标记价格频道
        this.handlePrice(recvData, 'mark');
        break;
      // / 私有
      case 'futures/account': // 用户账户信息频道
        // console.log('recv account info %j', recvData);
        this.emit('account', recvData);
        break;
      case 'futures/position': // 用户持仓信息频道
        // console.log('recv position info %j', recvData);
        this.emit('position', recvData);
        break;
      case 'futures/order': // 用户交易数据频道
        // console.log('recv order info %j', recvData);
        this.emit('order');
        break;
      default: // 各种 k 线
        break;
    }
  }

  handleTicker(data) {
    // 每秒 Ticker
    // console.log('Ticker %j', data);
    this.ticker = {
      high: data.high_24h,
      low: data.low_24h,
      volume: data.volume_24h,
      info: data,
    };
    this.emit('ticker');
  }

  handleTrade(data) {
    // 逐笔交易
    // console.log('Trides %j', data);
    this.lastTrade = {
      side: data.side,
      qty: data.qty,
      price: data.price,
      info: data,
    };
    this.emit('trade');
  }

  handlePrice(data, type) {
    // 各种价格变动
    switch (type) {
      case 'estimated':
        // 交割价格
        // console.log('Estimated Price %j', data);
        this.priceEstimated = data.settlement_price;
        break;
      case 'range':
        // 最大买入 最小卖出 价格 - 防止砸盘设置的
        // console.log('Price Range %j', data);
        this.priceRange = { maxBid: data.highest, minAsk: data.lowest };
        break;
      case 'mark':
        // 标记价格
        // console.log('Mark Price %j', data);
        this.priceMark = data.mark_price;
        break;
      default:
        return;
    }
    this.emit('price');
  }

  handleDepthData(data) {
    // 行情数据
    // table, action, data[0]: {instrument_id, asks, bids, timestamp, checksum}

    const asks = data.asks || []; // [价格,张数,爆仓单张数,深度由几笔订单构成]
    const bids = data.bids || [];
    // console.log('卖单更新: %j', asks);
    // console.log('买单更新: %j', bids);

    // TODO 自己合成 OrderBook
    // if (data.action === 'partial') {
    // } else if (data.action === 'update') {
    // }

    // asks.map(ask => {
    //   const price = ask[0];
    //   this.orderbook.asks[price] = ask;
    // });
    this.emit('orderbook');
  }

  handleDepth5Data(data) {
    // 5 档行情数据
    // table, action, data[0]: {instrument_id, asks, bids, timestamp, checksum}

    const asks = data.asks || []; // [价格,张数,爆仓单张数,深度由几笔订单构成]
    const bids = data.bids || [];
    this.orderbook5 = { asks, bids };
    this.emit('orderbook5');
  }

  getAsk1Bid1(level = 1) {
    const idx = level - 1;
    if (this.orderbook5 && this.orderbook5.asks && this.orderbook5.bids) {
      const ask = this.orderbook5.asks[idx];
      const bid = this.orderbook5.bids[idx];
      return { ask: [ask[0], ask[1]], bid: [bid[0], bid[1]] };
    }
    return { ask: null, bid: null };
  }
}

module.exports = FuturesOkex;

if (require.main === module) {
  const config = {
    key: '',
    secret: '',
    wskey: '',
    wssecret: '',
    passphrase: '',
    urlHost: 'https://www.okex.com',
    websocekHost: 'wss://real.okex.com:10442/ws/v3',
  };

  const futuresInstrumentId = 'BTC-USD-190524';

  // const publicChannels = [
  //   `futures/depth:${futuresInstrumentId}`,
  //   `futures/depth5:${futuresInstrumentId}`,
  //   `futures/ticker:${futuresInstrumentId}`,
  //   `futures/trade:${futuresInstrumentId}`,
  //   `futures/estimated_price:${futuresInstrumentId}`,
  //   `futures/price_range:${futuresInstrumentId}`,
  //   `futures/mark_price:${futuresInstrumentId}`,
  // ];
  // const privateChannels = [
  //   `futures/account:${futuresInstrumentId.split('-')[0]}`,
  //   `futures/position:${futuresInstrumentId}`,
  //   `futures/order:${futuresInstrumentId}`,
  // ];

  const futuresOkex = new FuturesOkex(futuresInstrumentId, config);
  futuresOkex.subscribe();

  // futuresOkex.on('orderbook5', () => {
  //   console.log('Ask %j Bid %j', futuresOkex.orderbook5.asks[0], futuresOkex.orderbook5.bids[0]);
  // });
  // futuresOkex.on('price', () => {
  //   console.log('Prices Estimated %s Mark %s Range %j',
  //     futuresOkex.priceEstimated || '--', futuresOkex.priceMark, futuresOkex.priceRange);
  // });
  // futuresOkex.on('ticker', () => {
  //   console.log('Ticker %j', futuresOkex.ticker);
  // });
  // futuresOkex.on('trade', () => {
  //   console.log('Trade %j', futuresOkex.lastTrade);
  // });
}
