'use strict';

let
  mosca = require('mosca');

/**
 * @constructor
 */
function MqttProtocol () {
  this.config = {};
  this.protocol = 'mqtt';
  this.context = null;
  this.connections = new WeakMap();
  this.connectionsById = {};
  this.server = {};

  this.init = function (config, context) {
    this.config = Object.assign({
      port: 1883,
      requestTopic: 'Kuzzle/request',
      responseTopic: 'Kuzzle/response',
      allowPubSub: false
    }, config || {});

    this.context = context;

    this.server = new mosca.Server({
      port: this.config.port,
      // We use default in-memory pub/sub backend to avoid external dependencies
      backend: {}
    });

    this.server.on('ready', this.setup.bind(this));

    /*
     To avoid ill-use of our topics, we need to configure authorizations:
      * "requestTopic": should be publish-only, so no one but this plugin can listen to this topic
      * "responseTopic": should be subscribe-only, so no one but this plugin can write in it
     */
    this.server.authorizePublish = (client, topic, payload, callback) => {
      if (this.config.allowPubSub) {
        const isAllowed = topic !== this.config.responseTopic
          && topic.indexOf('#') === -1
          && topic.indexOf('+') === -1;
        callback(null, isAllowed);
      }
      else {
        callback(null, topic === this.config.requestTopic);
      }
    };

    this.server.authorizeSubscribe = (client, topic, callback) => {
      const isAllowed = topic !== this.config.requestTopic
        && topic.indexOf('#') === -1
        && topic.indexOf('+') === -1;

      callback(null, isAllowed);
    };

    return this;
  };

  this.setup = function() {
    this.context.log.info(`[plugin-mqtt] MQTT server is up and running on port ${this.config.port}`);

    this.server.on('clientConnected', this.onConnection.bind(this));
    this.server.on('clientDisconnecting', this.onDisconnection.bind(this));
    this.server.on('clientDisconnected', this.onDisconnection.bind(this));
    this.server.on('published', this.onMessage.bind(this));
  };

  this.broadcast = function (data) {
    let payload;

    payload = JSON.stringify(data.payload);

    for (let i = 0; i < data.channels.length; i++) {
      this.server.publish({topic: data.channels[i], payload});
    }
  };

  this.notify = function (data) {
    if (this.connectionsById[data.connectionId]) {
      const
        client = this.connectionsById[data.connectionId],
        payload = JSON.stringify(data.payload);

      for (let i = 0; i < data.channels.length; i++) {
        client.forward(data.channels[i], payload, {}, data.channels[i], 0);
      }
    }
  };

  this.joinChannel = function () {
    // does nothing
  };

  this.leaveChannel = function () {
    // does nothing
  };

  /**
   *
   * @param {MoscaClient} client
   */
  this.onConnection = function (client) {
    try {
      const connection = new this.context.constructors.ClientConnection(this.protocol, [client.connection.stream.remoteAddress], {});
      this.context.accessors.router.newConnection(connection);

      this.connections.set(client, connection.id);
      this.connectionsById[connection.id] = client;
    }
    catch (e) {
      this.context.log.error('[plugin-mqtt] Unable to register new connection\n%s', e.stack);
      client.close();
    }

  };

  this.onDisconnection = function (client) {
    if (this.connections.has(client)) {
      const connectionId = this.connections.get(client);

      this.context.accessors.router.removeConnection(connectionId);
      this.connections.delete(client);
      delete this.connectionsById[connectionId];
    }
  };

  this.onMessage = function (packet, client) {
    if (packet.topic === this.config.requestTopic && packet.payload && client.id) {
      if (this.connections.has(client)) {
        let
          connectionId = this.connections.get(client),
          payload = JSON.parse(packet.payload.toString()),
          request = new this.context.constructors.Request(payload, {
            connectionId: connectionId,
            protocol: this.protocol
          });

        this.context.accessors.router.execute(request, response => {
          client.forward(this.config.responseTopic, JSON.stringify(response.content), {}, this.config.responseTopic, 0);
        });
      }
    }
  };

  this.disconnect = function (connectionId) {
    if (!this.connectionsById[connectionId]) {
      return;
    }

    this.connectionsById[connectionId].close(undefined, 'CLOSEDONREQUEST');
  };
}

module.exports = MqttProtocol;
