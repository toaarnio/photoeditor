//
//  storage
//
//  Created by Timo Reunanen on 2010-05-27.
//  Copyright (c) 2010 Nokia Oy. All rights reserved.
//

goog.require('goog.json');

goog.provide('nokia.Storage');

(function ($, nokia) {

	var demoImages = [
		'data/colorful-flowers.jpg',
    'data/Kimono_1920x1080.png'
	];

	/**.
	 * @namespace
	 *
	 * Simple API for handling localStorage 
	 */
	nokia.Storage = {};

	/**
	 * Save image with thumbnail to localStorage
	 *
	 * @param {String} imageName Images name.
	 * @param {String} imageData Image in DataURL format
	 * @param {String} [thumbnailData] Thumbnail image in DataURL format. Uses imageData if not defined.
	 */
	nokia.Storage.saveImage = function (imageName, imageData, thumbnailData) {

		if (thumbnailData === undefined) {
			thumbnailData = imageData;
		}

		var fileIndex = nokia.Storage.index();

		fileIndex[imageName] = {modtime: new Date()};

		localStorage.index = goog.json.serialize(fileIndex);

		localStorage['img_' + imageName] = imageData;
		localStorage['tb_' + imageName] = thumbnailData;
	};

	/**
	 * Save general data to localStorage.
	 *
	 * @param {String} name Datas name
	 * @param {Object} data Data. Uses {@link goog.json.serialize} to serialize.
	 */
	nokia.Storage.setData = function (name, data) {
		localStorage[name] = goog.json.serialize(data);
	};

	/**
	 * Get general data from localStorage.
	 *
	 * @param {String} name Name of the image.
	 * @param {Object} defaultValue Default value if nothing is found.
	 *
	 * @return {Object} Anything.
	 */
	nokia.Storage.getData = function (name, defaultValue) {
		if (localStorage[name]) {
			try {
				return goog.json.parse(localStorage[name]);
			} catch (err) {
			}
		}
		
		return defaultValue === undefined ? null : defaultValue;
	};

	/**
	 * Get Image data from localStorage
	 *
	 * @param {String} name Name of the image.
	 *
	 * @return {String} Image in DataURL format.
	 */
	nokia.Storage.getImageData = function (name) {
		return localStorage['img_' + name];
	};

	/**
	 * Get Images thumbnail data from localStorage
	 *
	 * @param {String} name Name of the image.
	 *
	 * @return {String} Image in DataURL format.
	 */
	nokia.Storage.getThumbnailData = function (name) {
		return localStorage['tb_' + name];
	};

	/**
	 * Retrieves an image by the given name from localStorage. The image is
   * assumed to be stored in dataURL format.
	 *
	 * @param {String} name the name of the image
	 * @param {Function} [onloadCallback] a callback function for the onload event
	 *
	 * @return {Image}
	 */
	nokia.Storage.loadImage = function (name, onloadCallback) {
		var img = new Image();
		img.onload = onloadCallback;
		img.src = nokia.Storage.getImageData(name);
		return img;
	};

	/**
	 * Retrieves the thumbnail of an image by the given name from
   * localStorage.  The thumbnail is assumed to be stored in dataURL
   * format.
	 *
	 * @param {String} name the name of the image whose thumbnail to retrieve
	 * @param {Function} [onloadCallback] a callback function for the onload event
	 *
	 * @return {Image}
	 */
	nokia.Storage.loadThumbnail = function (name, onloadCallback) {
		var img = new Image();
		img.onload = onloadCallback;
		img.src = nokia.Storage.getThumbnailData(name);
		return img;
	};

	/**
	 * Get index of saved images. Kind of FAT.
	 *
	 * @return {Object} Object/dictionary/hashtable of saved files.
	 */
	nokia.Storage.index = function () {
		var ret = null;

		if (localStorage.index) {
			try {
				ret = goog.json.parse(localStorage.index);
			} catch (err) {
				ret = {};
			}
		}

		return ret ? ret : {};
	};

	/**
	 * Remove file from localStorage
	 *
	 * @param {String} name Name of the image/data.
	 */
	nokia.Storage.remove = function (name) {
		var fileIndex = nokia.Storage.index();

		delete fileIndex[name];

		localStorage.index = goog.json.serialize(fileIndex);

		delete localStorage['img_' + name];
		delete localStorage['tb_' + name];
	};

	/**
	 * Remove all from localStorage.
	 */
	nokia.Storage.clear = function () {
		localStorage.clear();
	};

	/**
	 * Load demo images.
	 */
	nokia.Storage.loadDemoData = function () {
		for (var i = 0; i < demoImages.length; i++) {
			nokia.Storage.saveImage(demoImages[i], demoImages[i], demoImages[i]);
		}
	};

})(jQuery, nokia);
