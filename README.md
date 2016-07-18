[![Build Status](https://travis-ci.org/kuzzleio/kuzzle-plugin-mqtt.svg?branch=master)](https://travis-ci.org/kuzzleio/kuzzle-plugin-mqtt) [![codecov.io](http://codecov.io/github/kuzzleio/kuzzle-plugin-mqtt/coverage.svg?branch=master)](http://codecov.io/github/kuzzleio/kuzzle-plugin-mqtt?branch=master) [![Dependency Status](https://david-dm.org/kuzzleio/kuzzle-plugin-mqtt.svg)](https://david-dm.org/kuzzleio/kuzzle-plugin-mqtt)

![logo](https://raw.githubusercontent.com/kuzzleio/kuzzle/master/docs/images/logo.png)

# Kuzzle compatibility

Versions 1.x of this plugin are compatible with Kuzzle v1.0.0-RC.4 and upper.
# Protocol plugin: socket.io

Protocol plugin adding Socket.io support to Kuzzle.

# Manifest

This plugin doesn't need any right.

# Configuration

You can override the configuration in your `config/customPlugins.json` file in Kuzzle:

| Name | Default value | Type | Description                 |
|------|---------------|-----------|-----------------------------|
| ``port`` | ``7512`` | Integer > 1024 | Network port to open |
| ``room`` | ``"Kuzzle"`` | String | Name of the room listened by the plugin |

# How to create a plugin

See [Kuzzle documentation](https://github.com/kuzzleio/kuzzle/blob/master/docs/plugins.md) about plugin for more information about how to create your own plugin.

# About Kuzzle

For UI and linked objects developers, [Kuzzle](https://github.com/kuzzleio/kuzzle) is an open-source solution that handles all the data management
(CRUD, real-time storage, search, high-level features, etc).

[Kuzzle](https://github.com/kuzzleio/kuzzle) features are accessible through a secured API. It can be used through a large choice of protocols such as REST, Websocket or Message Queuing protocols.