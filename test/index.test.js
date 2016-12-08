'use strict';

const
  should = require('should'),
  proxyquire = require('proxyquire'),
  sinon = require('sinon');

describe('plugin implementation', function () {
  var
    Plugin,
    plugin,
    setPort,
    setBackend,
    onSpy = sinon.spy(),
    forwardSpy = sinon.spy(),
    publishSpy = sinon.spy(),
    badId = 'aBadId',
    goodId = 'aGoodId',
    goodChannel = 'aGoodChannel';

  before(function () {
    Plugin = proxyquire('../lib/index', {
      'mosca': {
        Server: function(config) {
          setPort = config.port;
          setBackend = config.backend;

          return {
            on: onSpy,
            publish: publishSpy,
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
    publishSpy.reset();
  });

  describe('#general', function () {
    it('should expose an init function', function () {
      should(plugin.init).be.a.Function();
    });
  });

  describe('#init', function () {
    var
      config = {port: 1234, requestTopic: 'aTopic', responseTopic: 'responseTopic'},
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

    it('should fallback to dummy-mode if no topic configuration has been provided', function () {
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
      config = {port: 1234, requestTopic: 'aTopic', responseTopic: 'responseTopic'},
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
      config = {port: 1234, requestTopic: 'aTopic', responseTopic: 'responseTopic'},
      context = {foo: 'bar'};

    it('should do nothing if in dummy-mode', function () {
      plugin.init({}, {}, true);
      should(plugin.broadcast({})).be.false();
    });

    it('should call forward if all conditions are met', function () {
      plugin.init(config, context, false);
      plugin.connectionPool = {
        [goodId]: {connection: 'aConnection', alive: true}
      };
      plugin.broadcast({
        channels: [goodChannel],
        payload: {a: 'payload'}
      });
      should(publishSpy.callCount).be.eql(1);
      should(publishSpy.firstCall.args[0]).be.deepEqual({topic: goodChannel, payload: JSON.stringify({a: 'payload'})});
    });
  });

  describe('#notify', function () {
    var
      config = {port: 1234, requestTopic: 'aTopic', responseTopic: 'topic'},
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
        [goodId]: {connection: 'aConnection', alive: true}
      };
      plugin.notify({
        connectionId: goodId,
        channels: [goodChannel],
        payload: {a: 'payload'}
      });

      should(forwardSpy.callCount).be.eql(1);
      should(forwardSpy.firstCall.args).be.deepEqual([
        goodChannel,
        JSON.stringify({a: 'payload'}),
        {},
        goodChannel,
        0
      ]);
    });
  });

  describe('#onConnection', function () {
    var
      config = {port: 1234, requestTopic: 'aTopic', responseTopic: 'responseTopic'},
      newConnectionSpy = sinon.stub().returns(Promise.resolve({a: 'connection'})),
      context = {accessors: {router: {newConnection: newConnectionSpy}}};

    beforeEach(() => {
      newConnectionSpy.reset();
    });

    it('should call router newConnection and treat its result', function (done) {
      plugin.init(config, context, false);
      plugin.onConnection({
        id: goodId
      });
      setTimeout(() => {
        try {
          should(plugin.connectionPool).be.deepEqual({
            [goodId]: {connection: {a: 'connection'}, alive: true}
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
      config = {port: 1234, requestTopic: 'aTopic', responseTopic: 'response'},
      removeConnectionSpy = sinon.stub().returns(Promise.resolve({a: 'connection'})),
      context = {accessors: {router: {removeConnection: removeConnectionSpy}}};

    beforeEach(() => {
      removeConnectionSpy.reset();
    });

    it('should call router removeConnection and remove connection', function () {
      plugin.init(config, context, false);
      plugin.connectionPool = {
        [goodId]: {connection: 'aConnection', alive: true}
      };
      plugin.onDisconnection({
        id: goodId
      });
      should(plugin.connectionPool).be.deepEqual({});
    });

    it('should do nothing if id does not exist', function () {
      plugin.init(config, context, false);
      plugin.connectionPool = {
        [goodId]: {connection: 'aConnection', alive: true}
      };
      plugin.onDisconnection({
        id: badId
      });
      should(plugin.connectionPool).be.deepEqual({[goodId]: {connection: 'aConnection', alive: true}});
    });
  });

  describe('#onMessage', function () {
    var
      config = {port: 1234, responseTopic: 'foo', requestTopic: 'bar'},
      fakeRequest = {aRequest: 'Object', requestId: 'foobar'},
      requestStub = sinon.stub().returns(fakeRequest),
      executeStub = sinon.stub().callsArgWith(1, fakeRequest),
      context = {constructors: {Request: requestStub}, accessors: {router: {execute: executeStub}}};

    beforeEach(() => {
      requestStub.reset();
      executeStub.reset();
    });

    it('should do nothing if the packet has not the good topic', function () {
      plugin.init(config, context, false);
      plugin.onMessage({fake: 'packet'}, {id: goodId});
      should(executeStub.callCount).be.eql(0);
      should(requestStub.callCount).be.eql(0);
    });

    it('should do nothing if the client is unknown', function () {
      plugin.init(config, context, false);
      plugin.connectionPool = {
        [goodId]: {connection: 'aConnection', alive: true}
      };
      plugin.onMessage({topic: config.requestTopic, payload: 'myPayload'}, {id: badId});
      should(executeStub.callCount).be.eql(0);
      should(requestStub.callCount).be.eql(0);
    });

    it('should execute the request if client and packet are ok', function () {
      let forwardStub = sinon.stub();

      plugin.init(config, context, false);
      plugin.connectionPool = {
        [goodId]: {connection: 'aConnection', alive: true}
      };

      plugin.onMessage({topic: config.requestTopic, payload: new Buffer('"aPayload"')}, {id: goodId, forward: forwardStub});
      should(requestStub.callCount).be.eql(1);
      should(requestStub.firstCall.args).be.deepEqual(['aPayload', 'aConnection']);
      should(executeStub.callCount).be.eql(1);
      should(executeStub.firstCall.args[0]).be.deepEqual(fakeRequest);
      should(executeStub.firstCall.args[1]).be.Function();
      should(forwardStub.callCount).be.eql(1);
      should(forwardStub.firstCall.args[0]).be.eql(config.responseTopic);
      should(forwardStub.firstCall.args[1]).be.eql(JSON.stringify(fakeRequest));
      should(forwardStub.firstCall.args[2]).be.deepEqual({});
      should(forwardStub.firstCall.args[3]).be.eql(config.responseTopic);
      should(forwardStub.firstCall.args[4]).be.eql(0);
    });
  });

  describe('#topic authorizations', () => {
    var config;

    beforeEach(() => {
      config = {port: 1234, responseTopic: 'foo', requestTopic: 'bar'};
    });

    it('should authorize publishing only to the request topic if allowPubSub is false', () => {
      config.allowPubSub = false;
      plugin.init(config, {}, false);

      plugin.server.authorizePublish(null, config.requestTopic, null, (err, res) => {
        should(res).be.true();
      });

      plugin.server.authorizePublish(null, config.responseTopic, null, (err, res) => {
        should(res).be.false();
      });

      plugin.server.authorizePublish(null, 'foobar', null, (err, res) => {
        should(res).be.false();
      });
    });

    it('should deny publishing only to the response topic if allowPubSub is true', () => {
      config.allowPubSub = true;
      plugin.init(config, {}, false);

      plugin.server.authorizePublish(null, config.requestTopic, null, (err, res) => {
        should(res).be.true();
      });

      plugin.server.authorizePublish(null, config.responseTopic, null, (err, res) => {
        should(res).be.false();
      });

      plugin.server.authorizePublish(null, 'foobar', null, (err, res) => {
        should(res).be.true();
      });
    });

    it('should deny subscribing to the request topic', () => {
      plugin.init(config, {}, false);

      plugin.server.authorizeSubscribe(null, config.requestTopic, (err, res) => {
        should(res).be.false();
      });

      plugin.server.authorizeSubscribe(null, config.responseTopic, (err, res) => {
        should(res).be.true();
      });

      plugin.server.authorizeSubscribe(null, 'foobar', (err, res) => {
        should(res).be.true();
      });
    });
  });
});
