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
 * "Edge Highlight" effect written in WebGL.  In technical terms, this
 * means sobel filtering results overlaid on the original image.
 *
 * @author Tomi Aarnio, Nokia Research Tampere, 2011
 */

goog.require('nokia.gl');
goog.require('nokia.utils');
goog.require('nokia.Effect');
goog.require('nokia.EffectManager');

goog.provide('nokia.effect.glSobel');

(function($, nokia) {

  /************************
   *
   *   CLASS DEFINITION
   *
   ***********************/

  nokia.effect.glSobel = function () {
    nokia.Effect.call(this);
  };
    
  goog.inherits(nokia.effect.glSobel, nokia.Effect);
  
  /************************
   *
   *   GLOBAL VARIABLES
   *
   ***********************/

  var ENABLED = false;
  var effectName = "Edge Highlight";
  var kernelURI = "shaders/sobel.gl";
  var self = nokia.effect.glSobel;

  /**
   * Effect initializer, called upon selecting the effect on
   * the 'Effects' menu.  At this point, we need to set up any
   * menu items other than 'Undo', 'Apply' and 'Cancel' which
   * are provided by the Effect base class.  This is also a good
   * opportunity to do full-frame preprocessing on the source
   * image.
   */
  self.prototype.init = function() {

    console.log(effectName + " init");

    var threshold = 0.5;  // default value

    var thresholdButton = $.getMenu().addSliderAttribute('Sensitivity', {
      min   : 0.0,
      max   : 1.0,
      value : threshold,
      step  : 0.005
    });

    var thresholdFunc = function (evt, ui) {
      self.apply(nokia.gl.context, 1.0-ui.value);
      nokia.Effect.glPaint();
    };

    // Set up the WebGL shader
    
    self.shader = nokia.gl.setupShaderProgram(nokia.gl.context, effectName);

    // Preprocess & measure speed

    nokia.utils.Timer.start("Sobel");
    self.apply(nokia.gl.context, threshold);
    var isInteractiveSpeed = nokia.utils.Timer.elapsed("Sobel", true) < 20 ? true : false;
    var sliderContainer = thresholdButton.data("attributeContainer").children();
    sliderContainer.bind(isInteractiveSpeed? "slide" : "slidechange", thresholdFunc);

    // Bring up the slider to give the user a hint that it can be adjusted

    thresholdButton.click();
  };

  self.prototype.uninit = function() {
	  console.log(effectName + " uninit");
  };

  ///////////////////////////////////////////////////////////////////////////////////////
  // WebGL drawing code
  //

  self.apply = function (gl, threshold) {

	  var uniforms = { "resolution" : [nokia.gl.width, nokia.gl.height], 
                     "threshold"  : threshold,
		                 "src"        : nokia.gl.textureOriginal };

    var width = nokia.gl.width;
    var height = nokia.gl.height;
    var dstPixels = new Uint8Array(nokia.gl.width * nokia.gl.height * 4);
    nokia.utils.Timer.start("  GL shader execution + copyTexImage + readPixels");
	  nokia.gl.renderToTexture(gl, nokia.gl.textureFiltered, self.shader, uniforms);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, dstPixels);
    nokia.utils.Timer.elapsed("  GL shader execution + copyTexImage + readPixels", true);
  };

  ///////////////////////////////////////////////////////////////////////////////////////
  // Effect registration
  //

  /**
   * Loads the shader source, and if all goes well, registers the
   * effect. Note that the shader can't be compiled at this stage,
   * because the WebGL context is not yet available.
   */
  
  if (ENABLED) {
    var kernelSrc = nokia.utils.loadKernel("", kernelURI);
    var success = !!kernelSrc;
    if (success === true) {
      nokia.gl.fsSources[effectName] = kernelSrc;
      nokia.EffectManager.register(effectName, self);
    }
  }

})(jQuery, nokia);
