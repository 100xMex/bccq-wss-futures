const EventEmitter = require('events');
const WebSocket = require('ws');
const pako = require('pako');

// 示例 channel 渠道
const pubChannels = [
  {
    tip: '订阅 KLine 数据',
    channel: 'market.BTC_CQ.kline.1min',
    context_path: 'market.$symbol.kline.$period',
    param_symbol: ['BTC_CW', 'BTC_NW', 'BTC_CQ'],
    param_period: ['1min', '5min', '15min', '30min', '60min', '1day', '1mon', '1week', '1year'],
  },
  // (150档数据) step0, step1, step2, step3, step4, step5（合并深度1-5）,step0时，不合并深度;
  // (20档数据) step6, step7, step8, step9, step10, step11（合并深度7-11）；step6时，不合并深度;
  {
    tip: '订阅 Market Depth 数据',
    channel: 'market.BTC_CQ.depth.step0',
    context_path: 'market.$symbol.depth.$type',
    param_symbol: ['BTC_CW', 'BTC_NW', 'BTC_CQ'],
    param_typpe: ['step0', 'step1', 'step2', 'step3', 'step4', 'step5', 'step6', 'step7', 'step8', 'step9', 'step10', 'step11'],
  },
  {
    tip: '订阅 Market Detail 数据',
    channel: 'market.BTC_CQ.detail',
    context_path: 'market.$symbol.detail',
    param_symbol: ['BTC_CW', 'BTC_NW', 'BTC_CQ'],
  },
  {
    tip: '订阅 Trade Detail 数据',
    channel: 'market.BTC_CQ.trade.detail',
    context_path: 'market.$symbol.trade.detail',
    param_symbol: ['BTC_CW', 'BTC_NW', 'BTC_CQ'],
  },
  {
    tip: '订阅 Trade Detail 数据',
    channel: 'orders.BTC_CQ',
    context_path: 'orders.$symbol',
    param_symbol: ['BTC_CW', 'BTC_NW', 'BTC_CQ'],
  },
];
const reqChannels = [
  {
    tip: '请求 KLine 数据',
    channel: 'market.BTC_CQ.kline.1min',
    context_path: 'market.$symbol.kline.$period',
    param_symbol: ['BTC_CW', 'BTC_NW', 'BTC_CQ'],
    param_period: ['1min', '5min', '15min', '30min', '60min', '1day', '1mon', '1week', '1year'],
  },
  {
    tip: '请求 Trade Detail 数据',
    channel: 'market.BTC_CQ.trade.detail',
    context_path: 'market.$symbol.trade.detail',
    param_symbol: ['BTC_CW', 'BTC_NW', 'BTC_CQ'],
  },
];

class PublicClient { }
exports.PublicClient = PublicClient;

class V3WebsocketClient extends EventEmitter {
  constructor(host) {
    super();
    this.host = host || 'wss://www.hbdm.com/ws'; // 行情请求订阅
    // this.host = host || 'wss://api.hbdm.com/notification'; // 合约订单推送地址
    // this.host = host || 'https://api.hbdm.com'; // 合约 api

    this.wss = null;
    this.id = 1;
    this.channels = {};
    this.apis = {};
  }

  connect() {
    if (!this.wss || this.wss.readyState === WebSocket.OPEN) {
      this.wss = new WebSocket(this.host, {
        perMessageDeflate: false,
      });
      this.wss.on('open', () => {
        console.log('socket open succeed.');
        this.emit('open');
      });
      this.wss.on('close', () => {
        console.log('socket close succeed.');
        this.emit('close');
      });
      this.wss.on('message', (data) => {
        const text = pako.inflate(data, { to: 'string' });
        // console.log('recv message %s', text);

        const msg = JSON.parse(text);
        if (msg.ping) {
          // console.log('ping message %j', msg);
          this.wss.send(JSON.stringify({ pong: msg.ping }));
        } else {
          // console.log('recv message', text);
          this.emit('message', text);
        }
      });
    }
    return this;
  }

  close() {
    if (this.wss.readyState === WebSocket.OPEN) this.wss.close();
  }

  subscribe(channel) {
    console.log('subscribe %s', channel);
    this.id += 1;
    const params = {
      sub: channel, id: `id${this.id}`,
    };
    this.channels[channel] = params;
    this.wss.send(JSON.stringify(params));
  }

  request(api) {
    this.id += 1;
    const params = {
      req: api, id: `id${this.id}`,
    };
    this.apis[api] = params;
    this.wss.send(JSON.stringify(params));
  }
}
exports.V3WebsocketClient = V3WebsocketClient;

class AuthenticatedClient { }
exports.AuthenticatedClient = AuthenticatedClient;
