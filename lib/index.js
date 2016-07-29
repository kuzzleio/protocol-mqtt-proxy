var
  mosca = require('mosca'),
  async = require('async');

/**
 * @constructor
 */
function MqttProtocol () {
  this.config = {};
  this.protocol = 'mqtt';
  this.isDummy = false;
  this.context = null;
  this.channels = {};
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
    console.log(`Mosca server is up and running on port ${this.config.port}`);

    this.server.on('clientConnected', this.onConnection.bind(this));
    this.server.on('clientDisconnecting', this.onDisconnection.bind(this));
    this.server.on('clientDisconnected', this.onDisconnection.bind(this));
    this.server.on('published', this.onMessage.bind(this));
  };

  this.broadcast = function (data) {
    if (this.isDummy) {
      return false;
    }

    if (this.channels[data.channel]) {
      // We include the channel in the sent payload
      data.payload.room = data.channel;
      async.each(this.channels[data.channel], (clientId) => {
        if (this.connectionPool[clientId]) {
          this.server.clients[clientId].forward(
            this.config.room,
            JSON.stringify(data.payload),
            {},
            this.config.room,
            0
          );
        }
      });
    }
  };

  this.notify = function (data) {
    if (this.isDummy) {
      return false;
    }

    if (this.connectionPool[data.id]) {
      // We include the channel in the sent payload
      data.payload.room = data.channel;
      this.server.clients[data.id].forward(
        this.config.room,
        JSON.stringify(data.payload),
        {},
        this.config.room,
        0
      );
    }
  };

  this.joinChannel = function (data) {
    if (this.isDummy) {
      return false;
    }

    if (this.connectionPool[data.id]) {
      if (!this.channels[data.channel]) {
        this.channels[data.channel] = [];
      }

      this.channels[data.channel].push(data.id);
    }
  };

  this.leaveChannel = function (data) {
    var index;

    if (this.isDummy) {
      return false;
    }

    if (this.connectionPool[data.id]) {
      if (this.channels[data.channel]) {
        index = this.channels[data.channel].indexOf(data.id);
        if (index !== -1) {
          this.channels[data.channel].splice(index, 1);

          if (this.channels[data.channel].length === 0) {
            delete this.channels[data.channel];
          }
        }
      }
    }
  };

  this.onConnection = function (client) {
    this.context.accessors.router.newConnection(this.protocol, client.id)
      .then(connection => {
        this.connectionPool[client.id] = connection;
      });
  };

  this.onDisconnection = function (client) {
    if (this.connectionPool[client.id]) {
      this.context.accessors.router.removeConnection(this.connectionPool[client.id]);
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
      if (this.connectionPool[clientId]) {
        payload = JSON.parse(packet.payload.toString());
        requestObject = new this.context.constructors.RequestObject(payload, {}, this.protocol);

        this.context.accessors.router.execute(
          requestObject,
          this.connectionPool[clientId],
          (error, response) => {
            client.forward(
              this.config.room,
              JSON.stringify(response),
              {},
              this.config.room,
              0
            );
          }
        );
      }
    }
  };
}

module.exports = MqttProtocol;
