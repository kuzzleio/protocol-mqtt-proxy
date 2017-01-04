'use strict';

const
  should = require('should'),
  Promise = require('bluebird'),
  proxyquire = require('proxyquire'),
  sinon = require('sinon');

describe('mqtt', () => {
  const
    ServerMock = function (config) {
      this.config = config;
      this.on = sinon.spy();
      this.publish = sinon.spy();
    },
    Plugin = proxyquire('../lib/index', {
      mosca: {Server: ServerMock}
    });

  let
    client,
    context,
    plugin;

  beforeEach(() => {
    client = {
      id: 'clientId',
      close: sinon.spy(),
      connection: {
        stream: {
          remoteAddress: 'remoteAddress'
        }
      },
      forward: sinon.spy()
    };
    context = {
      accessors: {
        router: {
          execute: sinon.spy(),
          newConnection: sinon.spy(),
          removeConnection: sinon.spy()
        }
      },
      constructors: {
        ClientConnection: sinon.spy(function () {
          this.id = 'clientConnectionId';     // eslint-disable-line no-invalid-this
        }),
        Request: sinon.stub().returns({a: 'request'})
      },
      log: {
        info: sinon.spy(),
        error: sinon.spy()
      }
    };

    plugin = new Plugin();
    plugin.init(undefined, context);
  });

  describe('#constructor', () => {
    it('should take the given config', () => {
      const config = {
        port: 1234,
        requestTopic: 'reqTopic',
        responseTopic: 'respTopic',
        allowPubSub: 'allowPubsub'
      };

      plugin.init(config);

      should(plugin.config)
        .match(config);
    });

    it('should properly set server authorizations', () => {
      let
        pub = Promise.promisify(plugin.server.authorizePublish.bind(plugin)),
        sub = Promise.promisify(plugin.server.authorizeSubscribe.bind(plugin));

      return pub('client', 'no', 'payload')
        .then(response => {
          should(response).be.false();
          return pub('client', plugin.config.requestTopic, 'payload');
        })
        .then(response => {
          should(response).be.true();

          plugin.config.allowPubSub = true;
          pub = Promise.promisify(plugin.server.authorizePublish.bind(plugin));

          return pub('client', plugin.config.responseTopic, 'payload');
        })
        .then(response => {
          should(response).be.false();

          return pub('client', 'no#wildcard', 'payload');
        })
        .then(response => {
          should(response).be.false();

          return pub('client', 'no+wildcard', 'payload');
        })
        .then(response => {
          should(response).be.false();

          return pub('client', plugin.config.responseTopic, 'payload');
        })
        .then(response => {
          should(response).be.false();

          return pub('client', 'valid', 'payload');
        })
        .then(response => {
          should(response).be.true();

          return pub('client', 'no#wildcard', 'payload');
        })
        .then(response => {
          should(response).be.false();

          return pub('client', 'no+wildcard', 'payload');
        })
        .then(response => {
          should(response).be.false();

          return pub('client', 'other', 'payload');
        })
        .then(response => {
          should(response).be.true();

          return sub('client', plugin.config.requestTopic);
        })
        .then(response => {
          should(response).be.false();

          return sub('client', 'no#wildcard');
        })
        .then(response => {
          should(response).be.false();

          return sub('client', 'no+wildcard');
        })
        .then(response => {
          should(response).be.false();

          return sub('client', 'imok');
        })
        .then(response => {
          should(response).be.true();
        });
    });
  });

  describe('#setup', () => {
    it('should attach events', () => {
      plugin.setup();

      should(context.log.info)
        .be.calledOnce();

      should(plugin.server.on)
        .have.callCount(5)
        .be.calledWith('clientConnected')
        .be.calledWith('clientDisconnecting')
        .be.calledWith('clientDisconnected')
        .be.calledWith('published');
    });
  });

  describe('#broadcast', () => {
    it('should publish to all channeld', () => {
      const data = {
        payload: 'payload',
        channels: []
      };

      for (let i = 0; i < 5; i++) {
        data.channels.push('topic_' + i);
      }

      plugin.broadcast(data);

      should(plugin.server.publish)
        .have.callCount(5);

      for (let i = 0; i < 5; i++) {
        should(plugin.server.publish)
          .be.calledWithMatch({
            topic: 'topic_' + i,
            payload: '"payload"'
          });
      }
    });
  });

  describe('#notify', () => {
    it('should notify the target client', () => {
      const
        data = {
          connectionId: 'connectionId',
          payload: 'payload',
          channels: []
        };

      plugin.connectionsById.connectionId = client;

      for (let i = 0; i < 3; i++) {
        data.channels.push('topic_' + i);
      }

      plugin.notify(data);

      should(client.forward)
        .be.calledThrice();

      for (let i = 0; i < 3; i++) {
        should(client.forward)
          .be.calledWithMatch('topic_' + i, '"payload"', {}, 'topic_' + i, 0);
      }
    });
  });

  describe('#onConnection', () => {
    it('should close the client connection if it cannot register it', () => {
      const error = new Error('test');
      context.constructors.ClientConnection = sinon.stub().throws(error);

      plugin.onConnection(client);

      should(context.log.error)
        .be.calledOnce()
        .be.calledWith('[plugin-mqtt] Unable to register new connection\n%s', error.stack);

      should(client.close)
        .be.calledOnce();
    });

    it('should register the connection', () => {
      plugin.onConnection(client);

      should(context.accessors.router.newConnection)
        .be.calledOnce()
        .be.calledWith(context.constructors.ClientConnection.firstCall.returnValue);
      should(plugin.connections.has(client)).be.true();
      should(plugin.connections.get(client)).be.exactly('clientConnectionId');
      should(plugin.connectionsById.clientConnectionId).be.exactly(client);
    });
  });

  describe('#onDisconnection', () => {
    it('should remove the connection from the pool', () => {
      plugin.connections.set(client, 'id');
      plugin.connectionsById.id = client;

      plugin.onDisconnection(client);

      should(context.accessors.router.removeConnection)
        .be.calledOnce()
        .be.calledWith('id');

      should(plugin.connections.has(client)).be.false();
    });
  });

  describe('#onMessage', () => {
    it('should pass the request to the proxy and get the response back', () => {
      plugin.connections.set(client, 'connectionId');
      plugin.connectionsById.connectionId = client;

      plugin.onMessage({
        topic: plugin.config.requestTopic,
        payload: '"payload"'
      }, client);

      should(context.constructors.Request)
        .be.calledOnce()
        .be.calledWith('payload', {
          connectionId: 'connectionId',
          protocol: plugin.protocol
        });

      const request = context.constructors.Request.firstCall.returnValue;

      should(context.accessors.router.execute)
        .be.calledOnce()
        .be.calledWith(request);

      const cb = context.accessors.router.execute.firstCall.args[1];
      cb({content: 'response'});

      should(client.forward)
        .be.calledOnce()
        .be.calledWithMatch(plugin.config.responseTopic, '"response"', {}, plugin.config.responseTopic, 0);
    });
  });

  describe('#disconnect', () => {
    it('should do nothing if the connection is not registered', () => {
      plugin.disconnect('foo');
    });

    it('should close the connection', () => {
      plugin.connectionsById.connectionId = client;

      plugin.disconnect('connectionId');
      should(client.close)
        .be.calledOnce()
        .be.calledWith(undefined, 'CLOSEDONREQUEST');
    });
  });

});

