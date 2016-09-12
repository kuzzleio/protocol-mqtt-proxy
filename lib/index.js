var
  mosca = require('mosca');

/**
 * @constructor
 */
function MqttProtocol () {
  this.config = {};
  this.protocol = 'mqtt';
  this.isDummy = false;
  this.context = null;
  this.connectionPool = {};
  this.server = {};

  this.init = function (config, context, isDummy) {
    if (!config) {
      throw new Error('plugin-mqtt: A configuration parameter is required');
    }

    if (!config.port) {
      this.isDummy = true;
      console.error(new Error('plugin-mqtt: the \'port\' attribute, with the port to listen to, is required'));
      return false;
    }

    if (!config.room) {
      this.isDummy = true;
      console.error(new Error('plugin-mqtt: the \'room\' attribute, with the room to listen to, is required'));
      return false;
    }

    this.isDummy = isDummy;
    this.config = config;
    this.context = context;

    if (this.isDummy) {
      return this;
    }

    this.server = new mosca.Server({
      port: config.port,
      // We use default in-memory pubsub backend to avoid external dependencies
      backend: {}
    });
    this.server.on('ready', this.setup.bind(this));

    return this;
  };

  this.setup = function() {
    console.log(`MQTT server is up and running on port ${this.config.port}`);

    this.server.on('clientConnected', this.onConnection.bind(this));
    this.server.on('clientDisconnecting', this.onDisconnection.bind(this));
    this.server.on('clientDisconnected', this.onDisconnection.bind(this));
    this.server.on('published', this.onMessage.bind(this));
  };

  this.broadcast = function (data) {
    var payload;

    if (this.isDummy) {
      return false;
    }

    payload = JSON.stringify(data.payload);

    data.channels.forEach(channel => {
      this.server.publish({topic: channel, payload});
    });
  };

  this.notify = function (data) {
    var payload;
    if (this.isDummy) {
      return false;
    }

    if (this.connectionPool[data.id] && this.connectionPool[data.id].alive) {
      payload = JSON.stringify(data.payload);

      data.channels.forEach(channel => {
        this.server.clients[data.id].forward(channel, payload, {}, channel, 0);
      });
    }
  };

  this.joinChannel = function (data) {
    // do nothing
  };

  this.leaveChannel = function (data) {
    // do nothing
  };

  this.onConnection = function (client) {
    this.context.accessors.router.newConnection(this.protocol, client.id)
      .then(connection => {
        this.connectionPool[client.id] = {
          alive: true,
          connection
        };
      });
  };

  this.onDisconnection = function (client) {
    var index;

    if (this.connectionPool[client.id] && this.connectionPool[client.id].alive) {
      this.connectionPool[client.id].alive = false;
      this.context.accessors.router.removeConnection(this.connectionPool[client.id].connection);
      delete this.connectionPool[client.id];
    }
  };

  this.onMessage = function (packet, client) {
    var
      requestObject,
      clientId,
      payload;

    if (packet.topic === this.config.room && packet.payload && client.id) {
      clientId = client.id;
      if (this.connectionPool[clientId] && this.connectionPool[clientId].alive) {
        payload = JSON.parse(packet.payload.toString());
        requestObject = new this.context.constructors.RequestObject(payload, {}, this.protocol);

        this.context.accessors.router.execute(
          requestObject,
          this.connectionPool[clientId].connection,
          (error, response) => {
            response.room = response.requestId;

            client.forward(
              this.config.responseRoom,
              JSON.stringify(response),
              {},
              this.config.responseRoom,
              0
            );

          }
        );
      }
    }
  };
}

module.exports = MqttProtocol;
