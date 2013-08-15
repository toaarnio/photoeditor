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
 * A generic 5x5 filter kernel with adjustable coefficients, written
 * in WebGL.
 *
 * @author Tomi Aarnio, Nokia Research Tampere, 2011
 */

goog.require('nokia.gl');
goog.require('nokia.utils');
goog.require('nokia.Effect');
goog.require('nokia.EffectManager');

goog.provide('nokia.effect.glFilter');

(function($, nokia) {

  /************************
   *
   *   CLASS DEFINITION
   *
   ***********************/

  nokia.effect.glFilter = function () {
    nokia.Effect.call(this);
  };

  goog.inherits(nokia.effect.glFilter, nokia.Effect);

  /************************
   *
   *   GLOBAL VARIABLES
   *
   ***********************/

  var ENABLED = true;
  var effectName = "Sharpen / Blur";
  var kernelURI = "shaders/genfilter.gl";
  var self = nokia.effect.glFilter;

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

    var threshold = 0.2;

    var thresholdButton = $.getMenu().addSliderAttribute('Blurriness', {
      min   : 0.000,
      max   : 1.000,
      value : threshold,
      step  : 0.005
    });

    var thresholdFunc = function (evt, ui) {
      self.apply(nokia.gl.context, ui.value);
    };

    // Set up WebGL shaders

    self.shader = nokia.gl.setupShaderProgram(nokia.gl.context, effectName);

    // Preprocessing: The result goes to nokia.gl.textureFiltered

    nokia.utils.Timer.start("Filter");
    self.apply(nokia.gl.context, threshold);
    nokia.gl.context.finish();
    var isInteractiveSpeed = nokia.utils.Timer.elapsed("Filter", true) < 20 ? true : false;
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

	  var uniforms = { "resolution"  : [nokia.gl.width, nokia.gl.height], 
		                 "src"         : nokia.gl.textureOriginal,
                     "weights"     : [1/50, 1/50, 2/50, 1/50, 1/50,
                                      1/50, 2/50, 4/50, 2/50, 1/50,
                                      2/50, 4/50, 6/50, 4/50, 2/50,
                                      1/50, 2/50, 4/50, 2/50, 1/50,
                                      1/50, 1/50, 2/50, 1/50, 1/50]
                   };

    var kernelWidth = 5;
    var kernelHalfWidth = 2;
    var kernelSize = kernelWidth * kernelWidth;
    var kernelSum = 0;

    // Gaussian blur
    //
    if (threshold > 0.5) {
      var stddev = (threshold-0.5) * 4;
      for (var i=0; i < kernelWidth*kernelWidth; i++) {
        var x = (i % kernelWidth) - kernelHalfWidth;
        var y = Math.floor(i / kernelWidth) - kernelHalfWidth;
        var weight = self.gaussian(x, y, stddev);
        uniforms.weights[i] = weight;
        kernelSum += weight;
      }
      for (var i=0; i < kernelWidth*kernelWidth; i++) {
        uniforms.weights[i] /= kernelSum;
      }
    } 

    // Sharpening
    //
    if (threshold <= 0.5) {
      var peak = -threshold*10 + 5;  // range: [0, 5]
      for (var i=0; i < kernelWidth*kernelWidth; i++) {
        var x = (i % kernelWidth) - kernelHalfWidth;
        var y = Math.floor(i / kernelWidth) - kernelHalfWidth;
        var weight = -peak / (kernelSize - 1);
        if (x==0 && y==0) {
          weight = peak + 1;
        }
        uniforms.weights[i] = weight;
      }
    }

	  nokia.gl.renderToTexture(gl, nokia.gl.textureFiltered, self.shader, uniforms);
    nokia.Effect.glPaint();
  };

  self.gaussian = function (x, y, stddev) {
    var denominator = 2 * 3.1415926 * stddev * stddev;
    var exponent =  -(x*x + y*y) / (2 * stddev * stddev);
    return Math.exp(exponent) / denominator;
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
