'use strict';
/**
 * The ReadOnlyManager manages the database and rendering releated to read only pads
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


import {db} from './DB';
import randomString from '../utils/randomstring';


/**
 * checks if the id pattern matches a read-only pad id
 * @param {String} id the pad's id
 */
export const isReadOnlyId = (id: string) => id.startsWith('r.');

/**
 * returns a read only id for a pad
 * @param {String} padId the id of the pad
 */
export const getReadOnlyId = async (padId) => {
  // check if there is a pad2readonly entry
  let readOnlyId = await db.get(`pad2readonly:${padId}`);

  // there is no readOnly Entry in the database, let's create one
  if (readOnlyId == null) {
    readOnlyId = `r.${randomString(16)}`;
    await Promise.all([
      db.set(`pad2readonly:${padId}`, readOnlyId),
      db.set(`readonly2pad:${readOnlyId}`, padId),
    ]);
  }

  return readOnlyId;
};

/**
 * returns the padId for a read only id
 * @param {String} readOnlyId read only id
 */
export const getPadId = async (readOnlyId) => await db.get(`readonly2pad:${readOnlyId}`);

/**
 * returns the padId and readonlyPadId in an object for any id
 * @param {String} id padIdOrReadonlyPadId read only id or real pad id
 */
export const getIds = async (id: string) => {
  const readonly = exports.isReadOnlyId(id);

  // Might be null, if this is an unknown read-only id
  const readOnlyPadId = readonly ? id : await exports.getReadOnlyId(id);
  const padId = readonly ? await exports.getPadId(id) : id;

  return {readOnlyPadId, padId, readonly};
};