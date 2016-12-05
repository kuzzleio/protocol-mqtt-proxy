'use strict';

let
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

    if (!config.requestTopic || !config.responseTopic) {
      this.isDummy = true;
      console.error(new Error('plugin-mqtt: the "requestTopic" and "responseTopic" attributes are required'));
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
      // We use default in-memory pub/sub backend to avoid external dependencies
      backend: {}
    });

    this.server.on('ready', this.setup.bind(this));

    /*
     To avoid ill-use of our topics, we need to configure authorizations:
      * "requestTopic": should be publish-only, so no one but this plugin can listen to this topic
      * "responseTopic": should be subscribe-only, so no one but this plugin can write in it
     */
    this.server.authorizePublish = function(client, topic, payload, callback) {
      if (config.allowPubSub) {
        callback(null, topic !== config.responseTopic);
      }
      else {
        callback(null, topic === config.requestTopic);
      }
    };

    this.server.authorizeSubscribe = function(client, topic, callback) {
      callback(null, topic !== config.requestTopic);
    };

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
    let payload;

    if (this.isDummy) {
      return false;
    }

    payload = JSON.stringify(data.payload);

    for (let i = 0; i < data.channels.length; i++) {
      this.server.publish({topic: data.channels[i], payload});
    }
  };

  this.notify = function (data) {
    if (this.isDummy) {
      return false;
    }

    if (this.connectionPool[data.connectionId] && this.connectionPool[data.connectionId].alive) {
      let payload = JSON.stringify(data.payload);

      for (let i = 0; i < data.channels.length; i++) {
        this.server.clients[data.connectionId].forward(data.channels[i], payload, {}, data.channels[i], 0);
      }
    }
  };

  this.joinChannel = function () {
    // does nothing
  };

  this.leaveChannel = function () {
    // does nothing
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
    if (this.connectionPool[client.id] && this.connectionPool[client.id].alive) {
      this.connectionPool[client.id].alive = false;
      this.context.accessors.router.removeConnection(this.connectionPool[client.id].connection);
      delete this.connectionPool[client.id];
    }
  };

  this.onMessage = function (packet, client) {
    if (packet.topic === this.config.requestTopic && packet.payload && client.id) {
      if (this.connectionPool[client.id] && this.connectionPool[client.id].alive) {
        let
          payload = JSON.parse(packet.payload.toString()),
          request = new this.context.constructors.Request(payload, this.connectionPool[client.id].connection);

        this.context.accessors.router.execute(request, response => {
          response.room = response.requestId;
          client.forward(this.config.responseTopic, JSON.stringify(response), {}, this.config.responseTopic, 0);
        });
      }
    }
  };
}

module.exports = MqttProtocol;
