'use strict';
const meow = require('meow');
const chalk = require('chalk')
module.exports = {
	getCli: function() {
		return meow(``, {
			flags: {
				// Used for the add event command
				endpoint: {
					type: 'string',
					alias: 'e'
				},
				bucket: {
					type: 'string',
					alias: 'b'
				},
				stack: {
					type: 'string',
					alias: 's'
				},
				region: {
					type: 'string',
					alias: 'r'
				},
				build: {
					type: 'boolean',
					alias: 'b'
				},
				prefix: {
					type: 'string',
					alias: 'p',
					default: ''
				},
				trim: {
					type: 'boolean',
					alias: 't'					
				},
				force: {
					type: 'boolean',
					alias: 'f'					
				},
				query: {
					type: 'string',
					alias: 'q',
					default: ''				
				}
			}
		})
	}
}
