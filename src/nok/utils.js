/*
 * This file is part of the Nokia WebCL project.
 *
 * This Source Code Form is subject to the terms of the
 * Mozilla Public License, v. 2.0. If a copy of the MPL
 * was not distributed with this file, You can obtain
 * one at http://mozilla.org/MPL/2.0/.
 *
 * The Original Contributor of this Source Code Form is
 * Nokia Research Tampere (http://webcl.nokiaresearch.com).
 */

/**
 * Common helper functions that have no dependencies on WebGL or WebCL.
 *
 * @author Tomi Aarnio, 2010-
 */

goog.provide('nokia.utils');

(function ($, nokia) {

  /**
   * @namespace
   *
   * Common helper functions that have no dependencies on WebGL or WebCL.
   */

  /**
   * A stopwatch timer based on the JavaScript built-in Date object.
   * Multiple concurrent measurements can be distinguished by unique
   * user-defined IDs.
   *
   * @example
   * nokia.utils.Timer.startTimer("myUniqueID");
   * someFunction();
   * var elapsed = nokia.utils.Timer.elapsed("myUniqueID");
   * console.log("someFunction() took", elapsed, "ms");
   * someOtherfunction();
   * elapsed = nokia.utils.Timer.elapsed("myUniqueID") - elapsed;
   * console.log("someOtherFunction() took", elapsed, "ms");
   */
  nokia.utils.Timer = {
    startTimes : [],

    'start' : function(id) { 
      nokia.utils.Timer.startTimes[id] = new Date().getTime(); 
    },

    'elapsed' : function(id, log) { 
      var elapsed = new Date().getTime() - nokia.utils.Timer.startTimes[id]; 
      if (log===true) { console.log(id, "took", elapsed, "ms"); }
      return elapsed;
    }
  };

  nokia.utils.clamp = function (val, min, max) {
    if (val < min) {
      val = min;
    }
    if (val > max) {
      val = max;
    }
    return val;
  };

  /**
   * Computes whether the given value is equal to the given
   * reference value, to within a given epsilon.
   *
   * @param {Number} val the value to compare
   * @param {Number} ref the reference value to compare with
   * @param {Number} epsilon the maximum difference allowed
   *
   * @return {boolean} 'true' if 'val' is in in the range
   * [ref-epsilon, ref+epsilon]
   */
  nokia.utils.isAboutEqual = function (val, ref, epsilon) {
    if (val >= ref-epsilon && val <= ref+epsilon) {
      //console.log(val + " ~= " + ref + " to within " + epsilon);
      return true;
    } else {
      //console.log(val + " != " + ref + " to within " + epsilon);
      return false;
    }
  };

  /**
   * Retrieves the source code of a CL or GL kernel from the
   * specified DOM element, or alternatively from the given URI
   * using synchronous XHR.  The priority order for searching
   * the kernel is as follows: 1) The 'text' field of the given
   * DOM element; 2) the 'src' field of that element; 3) the
   * given URI.
   *
   * @param {String} id the ID of the DOM element containing the
   * kernel source code; for example, "myShader". Can be left empty
   * when loading from a URI.
   *
   * @param {String} uri a fallback URI to try if the DOM
   * element does not exist or is empty; for example,
   * "kernels/myShader.gl"
   *
   * @param {Function} callback a function to call when the kernel
   * source code has been successfully loaded.  The source code is
   * passed as an argument to this function.  If no function is
   * provided, the kernel is loaded synchronously.
   *
   * @return {String} the source code of the specified kernel,
   * or 'null' if not found
   */
  nokia.utils.loadKernel = function (id, uri, callback) {
    var kernelElement = null;
    var kernelSource = null;
  
    if (id != null && id != "") {
      kernelElement = document.getElementById(id);
      if (kernelElement != null) {
        kernelSource = kernelElement.text;
      }
    }

    if (kernelElement && !kernelSource) {
      console.log("loadKernel: attempting to load from " + kernelElement.src + "...");
      kernelSource = nokia.utils.XMLHttpRequestGet(kernelElement.src);
    }
    
    if (!kernelSource) {
      console.log("loadKernel: attempting to load from " + uri + "...");
      if (callback) {
        console.log("  attempting asynchronous XMLHttpRequest...");
        nokia.utils.XMLHttpRequestGetAsync(uri, callback);
      } else {
        kernelSource = nokia.utils.XMLHttpRequestGet(uri);
      }
    }

    return kernelSource;
  };

  nokia.utils.loadFromGoogleStorage = function (uri) {
    uri = uri || "http://commondatastorage.googleapis.com/webcl/shadows_n900_wide.jpg";
    var data = nokia.utils.XMLHttpRequestGet(uri);
  };

  /**
   * Loads the given URI synchronously over HTTP.
   *
   * @param uri a String containing the URI to load, e.g. "myShader.gl"
   *
   * @return the HTTP response text, or null in case of error
   */

  var mHttpReq = new XMLHttpRequest();

  nokia.utils.XMLHttpRequestGet = function (uri) {
    //var mHttpReq = new XMLHttpRequest();
    mHttpReq.open("GET", uri + "?id="+ Math.random(), false);
    mHttpReq.send(null);
    return (mHttpReq.status == 200) ? mHttpReq.responseText : null;
  };

  /**
   * Loads the given URI asynchronously into a new ArrayBuffer. The
   * new ArrayBuffer is passed as a parameter to the given function
   * when the request has completed successfully.
   *
   * @param uri a String containing the URI to load, e.g. "values.bin"
   * @param callback a function to call when the request completes
   */

  nokia.utils.XMLHttpRequestGetArrayBuffer = function (uri, callback) {

    var xhr = new XMLHttpRequest();
    xhr.open("GET", uri, true);
    xhr.responseType = 'arraybuffer';

    xhr.onreadystatechange = function () {
      if (xhr.readyState == 4) {
        if (xhr.status == 200) {
          callback(xhr.response);
        }
      }
    };

    xhr.send(null);
  };

  /**
   * Translates the given (X, Y) point from the coordinate system of
   * the web page to the coordinate system of the given DOM element.
   * This is typically used to compute the coordinates of the mouse
   * pointer relative to a specific HTML element, such as a Canvas.
   *
   * @param obj the DOM object defining the target coordinate system
   * @param pageX the X coordinate relative to the page origin
   * @param pageY the Y coordinate relative to the page origin
   *
   * @return {[int, int]} the (X, Y) coordinates relative to the
   * given DOM object
   */
  nokia.utils.mapPageCoordsToElement = function(obj, pageX, pageY) {
    var xorg = 0;
    var yorg = 0;
    while (obj != null) {
      xorg += obj.offsetLeft;
      yorg += obj.offsetTop;
      obj = obj.offsetParent;
    }
    xorg = (pageX - xorg);
    yorg = (pageY - yorg);
    return [xorg, yorg];
  };

  /**
   * Checks the UserAgent string to see if we're running on a
   * Gecko-based browser. If the UA string contains "Gecko", but
   * not "like Gecko" (as in Chromium), then we can assume to be
   * running on genuine Gecko.
   *
   * @return {boolean} 'true' if the browser is Gecko-based,
   * 'false' otherwise
   */
  nokia.utils.isBrowserGecko = function () {
    if (navigator.userAgent.indexOf("Gecko") != -1) {
      if (navigator.userAgent.indexOf("like Gecko") == -1) {
        console.log("Running on Gecko: " + navigator.userAgent);
        return true;
      }
    }
    return false;
  };
  
})(jQuery, nokia);
