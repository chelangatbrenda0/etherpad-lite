'use strict';
/**
 * This is the Socket.IO Router. It routes the Messages between the
 * components of the Server. The components are at the moment: pad and timeslider
 */

/*
 * 2011 Peter 'Pita' Martischka (Primary Technology Ltd)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import log4js from 'log4js';
import {disableIPlogging} from "../utils/Settings";

import {createCollection} from '../stats';

const logger = log4js.getLogger('socket.io');

/**
 * Saves all components
 * key is the component name
 * value is the component module
 */
const components = {};

let io;

/**
 * adds a component
 */
exports.addComponent = (moduleName, module) => {
  if (module == null) return exports.deleteComponent(moduleName);
  components[moduleName] = module;
  module.setSocketIO(io);
};

exports.deleteComponent = (moduleName) => { delete components[moduleName]; };

/**
 * sets the socket.io and adds event functions for routing
 */
exports.setSocketIO = (_io) => {
  io = _io;

  io.sockets.on('connection', (socket) => {
    const ip = disableIPlogging ? 'ANONYMOUS' : socket.request.ip;
    logger.debug(`${socket.id} connected from IP ${ip}`);

    // wrap the original send function to log the messages
    socket._send = socket.send;
    socket.send = (message) => {
      logger.debug(`to ${socket.id}: ${JSON.stringify(message)}`);
      socket._send(message);
    };

    // tell all components about this connect
    for (const i of Object.keys(components)) {
      components[i].handleConnect(socket);
    }

    socket.on('message', (message, ack = (p: { name: any; message: any }) => {}) => (async () => {
      if (!message.component || !components[message.component]) {
        throw new Error(`unknown message component: ${message.component}`);
      }
      logger.debug(`from ${socket.id}:`, message);
      return await components[message.component].handleMessage(socket, message);
    })().then(
        (val) => ack({name: val.name, message: val.message}),
        (err) => {
          logger.error(
              `Error handling ${message.component} message from ${socket.id}: ${err.stack || err}`);
          ack({name: err.name, message: err.message}); // socket.io can't handle Error objects.
        }));

    socket.on('disconnect', (reason) => {
      logger.debug(`${socket.id} disconnected: ${reason}`);
      // store the lastDisconnect as a timestamp, this is useful if you want to know
      // when the last user disconnected.  If your activePads is 0 and totalUsers is 0
      // you can say, if there has been no active pads or active users for 10 minutes
      // this instance can be brought out of a scaling cluster.
      createCollection.gauge('lastDisconnect', () => Date.now());
      // tell all components about this disconnect
      for (const i of Object.keys(components)) {
        components[i].handleDisconnect(socket);
      }
    });
  });
};