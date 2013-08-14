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
 * WebGL "Frosted Glass" effect.
 *
 * @author Tomi Aarnio
 */

goog.require('nokia.gl');
goog.require('nokia.utils');
goog.require('nokia.Effect');
goog.require('nokia.EffectManager');

goog.provide('nokia.effect.glFrostedGlass');

(function($, nokia) {

  /************************
   *
   *   CONSTRUCTOR
   *
   ***********************/

  nokia.effect.glFrostedGlass = function () {
    nokia.Effect.call(this);
  };

  goog.inherits(nokia.effect.glFrostedGlass, nokia.Effect);

  /************************
   *
   *   GLOBAL VARIABLES
   *
   ***********************/

  var effectName = "Frosted Glass";
  var kernelURI = "shaders/frostedglass.gl";
  var self = nokia.effect.glFrostedGlass;

  /**
   * Effect initializer, called upon selecting the effect on
   * the 'Effects' menu.  At this point, we need to set up any
   * menu items other than 'Undo', 'Apply' and 'Cancel' which
   * are provided by the Effect base class.  This is also a good
   * opportunity to do full-frame preprocessing on the source
   * image.
   */
  self.prototype.init = function() {

    console.log("glFrostedGlass init");

    var distortionButton = $.getMenu().addSliderAttribute('Distortion', {
      min:0,
      max:1,
      value:0.2,
      step:0.01,
      slide: function (evt, ui) {
        self.apply(nokia.gl.context, ui.value);
		    nokia.Effect.glPaint();
      }
    });

    // Preprocessing: Preprocessed image goes to
    // nokia.gl.textureFiltered a.k.a. "filtered".

    self.glShaderFrostedGlass = nokia.gl.setupShaderProgram(nokia.gl.context, effectName);
    self.apply(nokia.gl.context, 0.2);
		nokia.Effect.glPaint();

    // Bring up the Distortion slider to give a hint to the user.

    distortionButton.click();
  };

  /**
   * uninit
   */

  self.prototype.uninit = function() {
	  console.log("glFrostedGlass uninit");
  };

  ///////////////////////////////////////////////////////////////////////////////////////
  // WebGL drawing code
  //

  self.apply = function (gl, alpha) {

	  var uniforms = { "resolution" : [nokia.gl.width, nokia.gl.height], 
		                 "alpha"      : alpha,
		                 "src"        : nokia.gl.textureOriginal };

	  nokia.gl.renderToTexture(gl, nokia.gl.textureFiltered, self.glShaderFrostedGlass, uniforms);
  };

  ///////////////////////////////////////////////////////////////////////////////////////
  // Effect registration
  //

  /**
   * Loads the shader source, and if all goes well, registers the
   * effect. Note that the shader can't be compiled at this stage,
   * because the WebGL context is not yet available.
   */
  
  (function register() {
    var kernelSrc = nokia.utils.loadKernel("", kernelURI);
    var success = !!kernelSrc;
    if (success === true) {
      nokia.gl.fsSources[effectName] = kernelSrc;
      nokia.EffectManager.register(effectName, self);
    }
  })();

})(jQuery, nokia);
