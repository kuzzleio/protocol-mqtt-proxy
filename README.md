[![Build Status](https://travis-ci.org/kuzzleio/kuzzle-plugin-mqtt.svg?branch=master)](https://travis-ci.org/kuzzleio/kuzzle-plugin-mqtt) [![codecov.io](http://codecov.io/github/kuzzleio/kuzzle-plugin-mqtt/coverage.svg?branch=master)](http://codecov.io/github/kuzzleio/kuzzle-plugin-mqtt?branch=master) [![Dependency Status](https://david-dm.org/kuzzleio/kuzzle-plugin-mqtt.svg)](https://david-dm.org/kuzzleio/kuzzle-plugin-mqtt)


# Table of Contents

- [Kuzzle compatibility](#kuzzle-compatibility)
- [Protocol plugin: MQTT](#protocol-plugin-mqtt)
- [Manifest](#manifest)
- [Configuration](#configuration)
- [How to use](#how-to-use)
  - [Sending an API request and getting the response](#sending-an-api-request-and-getting-the-response)
  - [Using Kuzzle subscriptions](#using-kuzzle-subscriptions)
- [Authorizations](#authorizations)
  - [Publishing](#publishing)
  - [Subscribing](#subscribing)
- [How to create a plugin](#how-to-create-a-plugin)
- [About Kuzzle](#about-kuzzle)


# Kuzzle compatibility

Versions 2.x of this plugin are compatible with Kuzzle v1.0.0-RC.5 and upper.

# Protocol plugin: MQTT

Protocol plugin adding MQTT support to Kuzzle.

# Manifest

This plugin doesn't need any right.

# Configuration

You can override the configuration in your `config/customPlugins.json` file in Kuzzle:

| Name | Default value | Type | Description                 |
|------|---------------|-----------|-----------------------------|
| ``allowPubSub`` | `false` | Boolean | Allow MQTT pub/sub capabilities or restrict to Kuzzle requests only | 
| ``port`` | ``1883`` | Integer > 1024 | Network port to open |
| ``requestTopic`` | ``"Kuzzle/request"`` | String | Name of the topic listened by the plugin for requests |
| ``responseTopic`` | ``"Kuzzle/response"`` | String | Name of the topic clients should listen to get requests result |

# How to use

## Sending an API request and getting the response

By default, this plugins listens to the `Kuzzle/request` MQTT topic (see [configuration](#configuration)) for requests to the [Kuzzle API](http://kuzzle.io/api-reference/).

It then forwards Kuzzle's response to the `Kuzzle/response` MQTT topic, and only to the client who made the initial request.

The order of responses is not guaranteed to be the same than the order of requests.
To link a response to its original request, use the `requestId` attribute: the response will have the same `requestId` than the one provided in the request.

Example using the [MQTT NodeJS module](https://www.npmjs.com/package/mqtt):

```js
var
  mqtt = require('mqtt'),
  client = mqtt.connect({host: 'localhost'});

// Sending a volatile message
client.publish('Kuzzle/request', JSON.stringify({
  index: 'index',
  collection: 'collection',
  controller: 'realtime',
  action: 'publish',
  requestId: 'some unique ID',
  body: { volatile: "message" }
}));

// Getting Kuzzle's response
client.on('message', (topic, raw) => {
  var message = JSON.parse(new Buffer(raw));

  // API results topic
  if (topic === 'Kuzzle/response') {
    // Response to our "publish" request
    if (message.requestId === 'some unique ID') {
      console.log('Message publication result: ', message);
    }
  }
});
```

## Using Kuzzle subscriptions

Kuzzle allows to [subscribe](http://kuzzle.io/api-reference/#subscribe) to messages and events using advanced filters.

Each time a subscription request is performed by a client, this plugin creates a dedicated MQTT topic, named after the provided `channel` by Kuzzle.

Here are the steps to perform a Kuzzle subscription using this MQTT plugin:

* Send a subscription request to Kuzzle
* Listen to the request's result to get the corresponding `channel` identifier
* Subscribe to the MQTT topic named after this channel identifier

Example using the [MQTT NodeJS package](https://www.npmjs.com/package/mqtt):

```js
var
  mqtt = require('mqtt'),
  client = mqtt.connect({host: 'localhost'}),
  channels = [];

// Sending a volatile message
client.publish('Kuzzle/request', JSON.stringify({
  index: 'index',
  collection: 'collection',
  controller: 'realtime',
  action: 'subscribe',
  requestId: 'some unique ID',
  body: {
    term: {
      some: 'filter'
    }
  }
}));

// Getting Kuzzle's response
client.on('message', (topic, raw) => {
  var message = JSON.parse(new Buffer(raw));

  // API results topic
  if (topic === 'Kuzzle/response') {
    // Response to our "publish" request
    if (message.requestId === 'some unique ID') {
      channels.push(message.result.channel);
      client.subscribe(message.result.channel);
    }
  }
  else if (channels.indexOf(topic) !== -1) {
    // Subscription notification
    console.log('Notification: ', message);
  }
});
```

# Authorizations

## Publishing

If ``allowPubSub`` is set to `false`, clients can only publish to the `requestTopic` topic (defaults to `Kuzzle/request`).

If `allowPubSub` is set to `true`, clients are only forbidden to publish to the `responseTopic` topic (defaults to `Kuzzle/response`).

If a client tries to publish to an unauthorized topic, his connection will immediately be shut down by the server.

## Subscribing

Subscription attempts to the ``requestTopic`` topic (defaults: `Kuzzle/request`) are ignored: client requests can only be listened by the MQTT server.


# How to create a plugin

See [Kuzzle documentation](http://kuzzle.io/guide/#plugins) about plugin for more information about how to create your own plugin.

# About Kuzzle

For UI and linked objects developers, [Kuzzle](https://github.com/kuzzleio/kuzzle) is an open-source solution that handles all the data management
(CRUD, real-time storage, search, high-level features, etc).

[Kuzzle](https://github.com/kuzzleio/kuzzle) features are accessible through a secured API. It can be used through a large choice of protocols such as REST, Websocket or Message Queuing protocols.
