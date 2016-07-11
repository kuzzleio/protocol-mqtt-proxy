var
  should = require('should'),
  EventEmitter = require('events'),
  proxyquire = require('proxyquire');


describe('plugin implementation', function () {
  var
    Plugin,
    plugin,
    emitter,
    setPort,
    fakeId = 'Verbal Kint',
    destination,
    linkedChannel,
    messageSent,
    notification;

  before(function () {
    // stubbing socket.io
    Plugin = proxyquire('../lib/index', {
      'socket.io': portNumber => {
      emitter = new EventEmitter();

    setPort = portNumber;

    emitter.id = fakeId;
    emitter.set = () => {};
    emitter.to = () => {
      return {
        emit: (channel, payload) => {
        messageSent = payload;
      destination = channel;
    }
    };
    };

    emitter.sockets = { connected: {} };
    emitter.sockets.connected[fakeId] = {
      join: channel => { linkedChannel = channel; },
    leave: channel => { linkedChannel = channel; },
    emit: (event, payload) => { notification = {event, payload}; }
  };

    return emitter;
  }
  });
  });

  beforeEach(function () {
    setPort = -1;
    destination = null;
    messageSent = null;
    linkedChannel = null;
    notification = null;
    plugin = new Plugin();
  });

  describe('#general', function () {
    it('should expose an init function', function () {
      should(plugin.init).be.a.Function();
    });

    it('should expose a hooks object', function () {
      var hooks = require('../lib/config/hooks');
      should(plugin.hooks).match(hooks);
    });
  });

  describe('#init', function () {
    var
      config = {port: 1234},
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

    it('should set internal properties correctly', function () {
      var
        ret = plugin.init(config, context, true);

      should(ret).be.eql(plugin);
      should(plugin.isDummy).be.true();
      should(plugin.config).be.eql(config);
      should(plugin.context).be.eql(context);
      should(setPort).be.eql(-1);
    });

    it('should start a socket.io broker if not in dummy mode', function () {
      var ret = plugin.init(config, context, false);

      should(ret).be.eql(plugin);
      should(plugin.isDummy).be.false();
      should(plugin.config).be.eql(config);
      should(plugin.context).be.eql(context);
      should(setPort).be.eql(1234);
    });

    it('should manage new connections on a "connection" event', function (done) {
      var
        stubSocket = { thisIsNot: 'aSocket' };

      this.timeout(50);

      plugin.newConnection = socket => {
        should(socket).be.eql(stubSocket);
        done();
      };

      plugin.init(config, context, false);
      emitter.emit('connection', stubSocket);
    });

    it('should fallback to dummy-mode if the broker is unable to start', function (done) {
      this.timeout(50);

      plugin.init(config, context, false);
      emitter.emit('error', 'fake error');
      process.nextTick(() => {
        should(plugin.isDummy).be.true();
      done();
    });
    });
  });

  describe('#broadcast', function () {
    var
      channel = 'foobar',
      payload = {foo: 'bar'};

    beforeEach(function () {
      plugin.init({port: 1234}, {}, false);
    });

    it('should do nothing if in dummy mode', function () {
      plugin.isDummy = true;
      plugin.broadcast({channel,payload});
      should(messageSent).be.null();
      should(destination).be.null();
    });

    it('should broadcast a message correctly', function () {
      plugin.broadcast({channel,payload});
      should(messageSent).be.eql(payload);
      should(destination).be.eql(channel);
    });
  });

  describe('#notify', function () {
    var
      channel = 'foobar',
      payload = {foo: 'bar'};

    beforeEach(function () {
      plugin.init({port: 1234}, {}, false);
    });

    it('should do nothing if in dummy mode', function () {
      plugin.isDummy = true;
      plugin.notify({id: fakeId,channel,payload});
      should(notification).be.null();
    });

    it('should notify a client correctly', function () {
      plugin.notify({id: fakeId, channel, payload});
      should(notification).not.be.null();
      should(notification.payload).be.eql(payload);
      should(notification.event).be.eql(channel);
    });
  });

  describe('#joinChannel', function () {
    beforeEach(function () {
      plugin.init({port: 1234}, {}, false);
    });

    it('should do nothing if in dummy mode', function () {
      plugin.isDummy = true;
      plugin.joinChannel({id: fakeId, channel: 'foo'});
      should(linkedChannel).be.null();
    });

    it('should link an id with a channel', function () {
      plugin.joinChannel({id: fakeId, channel: 'foo'});
      should(linkedChannel).be.eql('foo');
    });

    it('should do nothing if the id is unknown', function () {
      plugin.joinChannel({id: 'some other id', channel: 'foo'});
      should(linkedChannel).be.null();
    });
  });

  describe('#leaveChannel', function () {
    beforeEach(function () {
      plugin.init({port: 1234}, {}, false);
    });

    it('should do nothing if in dummy mode', function () {
      plugin.isDummy = true;
      plugin.leaveChannel({id: fakeId, channel: 'foo'});
      should(linkedChannel).be.null();
    });

    it('should link an id with a channel', function () {
      plugin.leaveChannel({id: fakeId, channel: 'foo'});
      should(linkedChannel).be.eql('foo');
    });

    it('should do nothing if the id is unknown', function () {
      plugin.leaveChannel({id: 'some other id', channel: 'foo'});
      should(linkedChannel).be.null();
    });
  });

  describe('#newConnection', function () {
    // some heavy stubbing here...
    var
      connection = {foo: 'bar'},
      fakeRequestId = 'fakeRequestId',
      serializedResponse = {bar: 'foo'},
      connected,
      executed,
      disconnected,
      response = {
          toJson: () => {
          return serializedResponse;
  }
  },
    context = {
      constructors: {
        RequestObject: function (foo) {
          foo.requestId = fakeRequestId;
          return foo;
        }
      }
    };

    beforeEach(function () {
      context.accessors = {};
      Object.defineProperty(context.accessors, 'router', {
        enumerable: true,
        get: function () {
          return {
              newConnection: (protocol, id) => {
              if (!id) {
            return Promise.rejected(new Error('rejected'));
          }

          should(protocol).be.eql(plugin.protocol);
          should(id).be.eql(emitter.id);
          connected = true;
          return Promise.resolve(connection);
        },
          execute: (request, conn, cb) => {
            should(conn).be.eql(connection);
            executed = true;

            if (request.errorMe) {
              return cb('errorMe', response);
            }

            cb(null, response);
          },
          removeConnection: () => {
            disconnected = true;
          }
        };
        }
      });
      plugin.init({port: 1234, room: 'foo'}, context, false);
      connected = executed = disconnected = false;
    });

    it('should do nothing if in dummy mode', function () {
      plugin.isDummy = true;

      should(plugin.newConnection(emitter)).be.false();
      should(connected).be.false();
    });

    it('should initialize a new connection', function () {
      plugin.newConnection(emitter);
      should(connected).be.true();
    });

    it('should listen to incoming requests and forward them to Kuzzle', function (done) {
      var payload = {fake: 'data'};
      this.timeout(100);
      plugin.newConnection(emitter);

      setTimeout(() => {
        emitter.emit(plugin.config.room, payload);

      setTimeout(() => {
        should(connected).be.true();
      should(executed).be.true();
      should(disconnected).be.false();
      should(messageSent).be.eql(response);
      should(destination).be.eql(fakeRequestId);
      done();
    }, 40);
    }, 20);
    });

    it('should forward an error to clients if Kuzzle throws one', function (done) {
      var payload = {errorMe: true};
      this.timeout(100);
      plugin.newConnection(emitter);

      setTimeout(() => {
        emitter.emit(plugin.config.room, payload);

      setTimeout(() => {
        should(connected).be.true();
      should(executed).be.true();
      should(disconnected).be.false();
      should(messageSent).be.eql(response);
      should(destination).be.eql(fakeRequestId);
      done();
    }, 20);
    }, 20);
    });

    it('should handle client disconnections', function (done) {
      this.timeout(100);
      plugin.newConnection(emitter);

      setTimeout(() => {
        emitter.emit('disconnect', {});

      setTimeout(() => {
        should(connected).be.true();
      should(executed).be.false();
      should(disconnected).be.true();
      should(messageSent).be.null();
      should(destination).be.null();
      done();
    }, 20);
    }, 20);
    });

    it('should handle client socket errors', function (done) {
      this.timeout(100);
      plugin.newConnection(emitter);

      setTimeout(() => {
        emitter.emit('error', {});

      setTimeout(() => {
        should(connected).be.true();
      should(executed).be.false();
      should(disconnected).be.true();
      should(messageSent).be.null();
      should(destination).be.null();
      done();
    }, 20);
    }, 20);
    });
  });
});