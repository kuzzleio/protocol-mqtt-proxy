var
  should = require('should'),
  proxyquire = require('proxyquire'),
  sinon = require('sinon');

require('sinon-as-promised')(Promise);

describe('plugin implementation', function () {
  var
    Plugin,
    plugin,
    setPort,
    setBackend,
    onSpy = sinon.spy(),
    forwardSpy = sinon.spy(),
    badId = 'aBadId',
    goodId = 'aGoodId',
    goodChannel = 'aGoodChannel',
    badChannel = 'aBadChannel';

  before(function () {
    // stubbing socket.io
    Plugin = proxyquire('../lib/index', {
      'mosca': {
        Server: function(config) {
          setPort = config.port;
          setBackend = config.backend;

          return {
            on: onSpy,
            clients: {
              [goodId]: {
                forward: forwardSpy
              }
            }
          };
        }
      }
    });
  });

  beforeEach(function () {
    setPort = -1;
    setBackend = null;
    plugin = new Plugin();
    onSpy.reset();
    forwardSpy.reset();
  });

  describe('#general', function () {
    it('should expose an init function', function () {
      should(plugin.init).be.a.Function();
    });
  });

  describe('#init', function () {
    var
      config = {port: 1234, room: 'aRoom'},
      context = {foo: 'bar'};

    it('should throw an error if no "config" argument has been provided', function (done) {
      try {
        plugin.init(undefined, {}, true);
        done(new Error('Expected a throw, but nothing happened'));
      }
      catch (e) {
        done();
      }
    });

    it('should fallback to dummy-mode if no port configuration has been provided', function () {
      var ret = plugin.init({}, {}, false);

      should(ret).be.false();
      should(plugin.isDummy).be.true();
    });

    it('should fallback to dummy-mode if no room configuration has been provided', function () {
      var ret = plugin.init({port: 1234}, {}, false);

      should(ret).be.false();
      should(plugin.isDummy).be.true();
    });

    it('should set internal properties correctly', function () {
      var
        ret = plugin.init(config, context, true);

      should(ret).be.eql(plugin);
      should(plugin.isDummy).be.true();
      should(plugin.config).be.eql(config);
      should(plugin.context).be.eql(context);
      should(setPort).be.eql(-1);
      should(setBackend).be.null();
    });

    it('should setup a mosca mqtt broker if not in dummy mode', function () {
      var ret = plugin.init(config, context, false);

      should(ret).be.eql(plugin);
      should(plugin.isDummy).be.false();
      should(plugin.config).be.eql(config);
      should(plugin.context).be.eql(context);
      should(setPort).be.eql(1234);
      should(onSpy.firstCall.args[0]).be.eql('ready');
      should(onSpy.firstCall.args[1]).be.Function();
    });
  });

  describe('#setup', function () {
    var
      config = {port: 1234, room: 'aRoom'},
      context = {foo: 'bar'};

    it('should bind functions to broker appropriate events', function () {
      plugin.init(config, context, false);
      plugin.setup();
      should(onSpy.getCall(0).args[0]).be.eql('ready');
      should(onSpy.getCall(0).args[1]).be.Function();
      should(onSpy.getCall(1).args[0]).be.eql('clientConnected');
      should(onSpy.getCall(1).args[1]).be.Function();
      should(onSpy.getCall(2).args[0]).be.eql('clientDisconnecting');
      should(onSpy.getCall(2).args[1]).be.Function();
      should(onSpy.getCall(3).args[0]).be.eql('clientDisconnected');
      should(onSpy.getCall(3).args[1]).be.Function();
      should(onSpy.getCall(4).args[0]).be.eql('published');
      should(onSpy.getCall(4).args[1]).be.Function();
    });
  });

  describe('#broadcast', function () {
    var
      config = {port: 1234, room: 'aRoom'},
      context = {foo: 'bar'};

    it('should do nothing if in dummy-mode', function () {
      plugin.init({}, {}, true);
      should(plugin.broadcast({})).be.false();
    });

    it('should do nothing if channel does not exist', function () {
      plugin.init(config, context, false);
      plugin.broadcast({
        channel: badChannel
      });
      should(forwardSpy.callCount).be.eql(0);
    });

    it('should do nothing if connection does not exist', function () {
      plugin.init(config, context, false);
      plugin.channels = {
        [goodChannel]: [goodId]
      };
      plugin.broadcast({
        channel: goodChannel,
        payload: {}
      });
      should(forwardSpy.callCount).be.eql(0);
    });

    it('should call forward if all conditions are met', function () {
      plugin.init(config, context, false);
      plugin.channels = {
        [goodChannel]: [goodId]
      };
      plugin.connectionPool = {
        [goodId]: true
      };
      plugin.broadcast({
        channel: goodChannel,
        payload: {a: 'payload'}
      });
      should(forwardSpy.callCount).be.eql(1);
      should(forwardSpy.firstCall.args).be.deepEqual([
        config.room,
        JSON.stringify({a: 'payload', room: goodChannel}),
        {},
        config.room,
        0
      ]);
    });
  });

  describe('#notify', function () {
    var
      config = {port: 1234, room: 'aRoom'},
      context = {foo: 'bar'};

    it('should do nothing if in dummy-mode', function () {
      plugin.init({}, {}, true);
      should(plugin.notify({})).be.false();
    });

    it('should do nothing if id does not exist', function () {
      plugin.init(config, context, false);
      plugin.notify({
        id: badId
      });
      should(forwardSpy.callCount).be.eql(0);
    });

    it('should call forward if all conditions are met', function () {
      plugin.init(config, context, false);
      plugin.connectionPool = {
        [goodId]: true
      };
      plugin.notify({
        id: goodId,
        channel: goodChannel,
        payload: {a: 'payload'}
      });
      should(forwardSpy.callCount).be.eql(1);
      should(forwardSpy.firstCall.args).be.deepEqual([
        config.room,
        JSON.stringify({a: 'payload', room: goodChannel}),
        {},
        config.room,
        0
      ]);
    });
  });

  describe('#joinChannel', function () {
    var
      config = {port: 1234, room: 'aRoom'},
      context = {foo: 'bar'};

    it('should do nothing if in dummy-mode', function () {
      plugin.init({}, {}, true);
      should(plugin.joinChannel({})).be.false();
    });

    it('should do nothing if id does not exist', function () {
      plugin.init(config, context, false);
      plugin.joinChannel({
        id: badId
      });
      should(plugin.channels).be.deepEqual({});
    });

    it('should add clientId to the channel if conditions are met', function () {
      plugin.init(config, context, false);
      plugin.channels = {
        [goodChannel]: []
      };
      plugin.connectionPool = {
        [goodId]: true
      };
      plugin.joinChannel({
        id: goodId,
        channel: goodChannel
      });
      should(plugin.channels).be.deepEqual({
        [goodChannel]: [goodId]
      });
    });

    it('should create the channel entry add clientId to the channel if conditions are met and channel did not exist before', function () {
      plugin.init(config, context, false);
      plugin.connectionPool = {
        [goodId]: true
      };
      plugin.joinChannel({
        id: goodId,
        channel: goodChannel
      });
      should(plugin.channels).be.deepEqual({
        [goodChannel]: [goodId]
      });
    });
  });

  describe('#leaveChannel', function () {
    var
      config = {port: 1234, room: 'aRoom'},
      context = {foo: 'bar'};

    it('should do nothing if in dummy-mode', function () {
      plugin.init({}, {}, true);
      should(plugin.leaveChannel({})).be.false();
    });

    it('should do nothing if id does not exist', function () {
      plugin.init(config, context, false);
      plugin.leaveChannel({
        id: badId
      });
      should(plugin.channels).be.deepEqual({});
    });

    it('should do nothing if channel does not exist', function () {
      plugin.init(config, context, false);
      plugin.connectionPool = {
        [goodId]: true
      };
      plugin.leaveChannel({
        id: goodId
      });
      should(plugin.channels).be.deepEqual({});
    });

    it('should do nothing if id is not in channel', function () {
      plugin.init(config, context, false);
      plugin.connectionPool = {
        [goodId]: true
      };
      plugin.channels = {
        [goodChannel]: [badId]
      };
      plugin.leaveChannel({
        id: goodId,
        channel: goodChannel
      });
      should(plugin.channels).be.deepEqual({
        [goodChannel]: [badId]
      });
    });

    it('should remove id from channel if conditions are met', function () {
      plugin.init(config, context, false);
      plugin.connectionPool = {
        [goodId]: true
      };
      plugin.channels = {
        [goodChannel]: [goodId, badId]
      };
      plugin.leaveChannel({
        id: goodId,
        channel: goodChannel
      });
      should(plugin.channels).be.deepEqual({
        [goodChannel]: [badId]
      });
    });

    it('should remove id from channel if conditions are met and remove channel if it is empty', function () {
      plugin.init(config, context, false);
      plugin.connectionPool = {
        [goodId]: true
      };
      plugin.channels = {
        [goodChannel]: [goodId]
      };
      plugin.leaveChannel({
        id: goodId,
        channel: goodChannel
      });
      should(plugin.channels).be.deepEqual({});
    });
  });

  describe('#onConnection', function () {
    var
      config = {port: 1234, room: 'aRoom'},
      newConnectionSpy = sinon.stub().resolves({a: 'connection'}),
      context = {accessors: {router: {newConnection: newConnectionSpy}}};

    beforeEach(() => {
      newConnectionSpy.reset();
    });

    it('should call router newConnection and treat its result', function (done) {
      this.timeout(100);
      plugin.init(config, context, false);
      plugin.onConnection({
        id: goodId
      });
      setTimeout(() => {
        try {
          should(plugin.connectionPool).be.deepEqual({
            [goodId]: {a: 'connection'}
          });

          done();
        }
        catch (e) {
          done(e);
        }
      }, 20);
    });
  });

  describe('#onDisconnection', function () {
    var
      config = {port: 1234, room: 'aRoom'},
      removeConnectionSpy = sinon.stub().resolves({a: 'connection'}),
      context = {accessors: {router: {removeConnection: removeConnectionSpy}}};

    beforeEach(() => {
      removeConnectionSpy.reset();
    });

    it('should call router removeConnection and remove connection', function () {
      this.timeout(100);
      plugin.init(config, context, false);
      plugin.connectionPool = {
        [goodId]: true
      };
      plugin.onDisconnection({
        id: goodId
      });
      should(plugin.connectionPool).be.deepEqual({});
    });

    it('should do nothing if id does not exist', function () {
      this.timeout(100);
      plugin.init(config, context, false);
      plugin.connectionPool = {
        [goodId]: true
      };
      plugin.onDisconnection({
        id: badId
      });
      should(plugin.connectionPool).be.deepEqual({[goodId]: true});
    });
  });

  describe('#onMessage', function () {
    var
      config = {port: 1234, room: 'aRoom'},
      fakeRequestObject = {aRequest: 'Object'},
      requestObjectStub = sinon.stub().returns(fakeRequestObject),
      executeStub = sinon.stub().callsArg(2),
      context = {constructors: {RequestObject: requestObjectStub}, accessors: {router: {execute: executeStub}}};

    beforeEach(() => {
      requestObjectStub.reset();
      executeStub.reset();
    });

    it('should do nothing if the packet has not the good room', function () {
      plugin.init(config, context, false);
      plugin.onMessage({fake: 'packet'}, {id: goodId});
      should(executeStub.callCount).be.eql(0);
      should(requestObjectStub.callCount).be.eql(0);
    });

    it('should do nothing if the client is unknown', function () {
      plugin.init(config, context, false);
      plugin.connectionPool = {
        [goodId]: true
      };
      plugin.onMessage({topic: config.room, payload: 'myPayload'}, {id: badId});
      should(executeStub.callCount).be.eql(0);
      should(requestObjectStub.callCount).be.eql(0);
    });

    it('should execute the request if client and packet are ok', function () {
      var forwardStub = sinon.stub();

      plugin.init(config, context, false);
      plugin.connectionPool = {
        [goodId]: 'aConnection'
      };
      plugin.onMessage({topic: config.room, payload: new Buffer('"aPayload"')}, {id: goodId, forward: forwardStub});
      should(requestObjectStub.callCount).be.eql(1);
      should(requestObjectStub.firstCall.args).be.deepEqual(['aPayload', {}, 'mqtt']);
      should(executeStub.callCount).be.eql(1);
      should(executeStub.firstCall.args[0]).be.deepEqual(fakeRequestObject);
      should(executeStub.firstCall.args[1]).be.eql('aConnection');
      should(executeStub.firstCall.args[2]).be.Function();
      should(forwardStub.callCount).be.eql(1);
      should(forwardStub.firstCall.args[0]).be.eql(config.room);
      should(forwardStub.firstCall.args[1]).be.eql(JSON.stringify(undefined));
      should(forwardStub.firstCall.args[2]).be.deepEqual({});
      should(forwardStub.firstCall.args[3]).be.eql(config.room);
      should(forwardStub.firstCall.args[4]).be.eql(0);
    });
  });
});
