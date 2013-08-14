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
 * WebCL implementation of Sobel filtering, also known as Edge
 * Detect. Requires the 'sobel.cl' kernel program.
 *
 * @author Tomi Aarnio, Nokia Research Tampere, 2011
 */

goog.require('nokia.gl');
goog.require('nokia.cl');
goog.require('nokia.utils');
goog.require('nokia.Effect');
goog.require('nokia.EffectManager');

goog.provide('nokia.effect.clSobel');

(function($) {

  /************************
   *
   *   CLASS DEFINITION
   *
   ***********************/

  nokia.effect.clSobel = function () {
    nokia.Effect.call(this);
  };
    
  goog.inherits(nokia.effect.clSobel, nokia.Effect);
  
  /************************
   *
   *   GLOBAL VARIABLES
   *
   ***********************/

  var effectName = "Edge Detect";
  var kernelName = "clSobel";
  var kernelURI = "shaders/sobel.cl";
  var self = nokia.effect.clSobel;

  /**
   * Initializes this Effect by setting up the necessary UI elements,
   * retrieving the image data from the 3D canvas, setting up WebCL
   * buffers, and executing the WebCL kernel with default parameters.
   */
  self.prototype.init = function() {

    self.threshold = 0.5;  // default value

    var thresholdButton = $.getMenu().addSliderAttribute('Threshold', {
      min   : 0.01,
      max   : 1.0,
      value : self.threshold,
      step  : 0.01
    });

    var thresholdFunc = function (evt, ui) {
      self.threshold = ui.value;
      self.prototype.apply(nokia.gl.textureFiltered, ui.value);
      nokia.Effect.glPaint();
    };

    self.prototype.initCL(nokia.cl.ctxIndex);

    // Sobel filtering: The result goes to nokia.gl.textureFiltered.
    // Also bring up the slider to give the user a hint that it can be
    // adjusted.

    nokia.utils.Timer.start("Sobel");
    self.prototype.apply(nokia.gl.textureFiltered, self.threshold);
    var isInteractiveSpeed = nokia.utils.Timer.elapsed("Sobel") < 20 ? true : false;
    var sliderContainer = thresholdButton.data("attributeContainer").children();
    sliderContainer.bind(isInteractiveSpeed? "slide" : "slidechange", thresholdFunc);
    nokia.Effect.glPaint();
    thresholdButton.click();
  };

  /**
   * Uninitializes the Sobel Effect
   */
  self.prototype.uninit = function() {
    console.log("clSobel uninit");
  };

  /**
   * Initializes the given CL context for this Effect.
   */
  self.prototype.initCL = function(clCtxIndex) {

    nokia.cl.selectContext(clCtxIndex);

    // Initialize WebCL buffers etc. to match the current image
    
    var useTexturing = true;
    nokia.gl.drawDefault(nokia.gl.context, nokia.gl.textureOriginal);
    nokia.cl.setupImage(nokia.gl.canvas, useTexturing);

    // Fill in the image-dependent arguments of the current kernel
    // (input/output buffers, width and height)

    nokia.cl.setupKernelArgs(nokia.cl.kernels[nokia.cl.ctxIndex][kernelName]);
  };

  /**
   * Applies the Sobel filter on the current image, storing the result
   * in the given GL texture.
   */
  self.prototype.apply = function(dstTexture, threshold) {

    threshold = threshold || self.threshold;

    //var mpixels = dstTexture.width * dstTexture.height / 1000000;
    //var relThreshold = 5 + threshold * 50 / Math.sqrt(mpixels);
    //console.log("  threshold = ", threshold, ", relative = ", relThreshold);

    console.log("  threshold = ", threshold);
    var dynamicArgs = { "threshold" : [threshold, WebCL.types.FLOAT] };
                        
    var kernel = nokia.cl.kernels[nokia.cl.ctxIndex][kernelName];

    nokia.cl.runKernel(kernel, dynamicArgs);

    nokia.cl.texImage2D(dstTexture);
  };

  /**
   * Sets up the WebCL context (if necessary), loads and builds the
   * kernel program, and if all goes well, registers the effect.
   * This function is executed only once, at the time of loading
   * this script file.
   */
  
  (function register() {
    var success = nokia.cl.setupKernel(kernelURI);
    if (success === true) {
      nokia.EffectManager.register(effectName, self);
    }
  })();

})(jQuery);
