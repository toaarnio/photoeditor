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
 * WebGL "Dreamy Vision" effect.
 *
 * @author Tomi Aarnio
 */

goog.require('nokia.gl');
goog.require('nokia.utils');
goog.require('nokia.Effect');
goog.require('nokia.EffectManager');

goog.provide('nokia.effect.glDreamyVision');

(function($, nokia) {

  /************************
   *
   *   CLASS DEFINITION
   *
   ***********************/

  nokia.effect.glDreamyVision = function () {
    nokia.Effect.call(this);
  };
    
  goog.inherits(nokia.effect.glDreamyVision, nokia.Effect);
  
  /************************
   *
   *   GLOBAL VARIABLES
   *
   ***********************/

  var ENABLED = true;
  var effectName = "Dreamy Vision";
  var kernelURI = "shaders/dreamyvision.gl";
  var self = nokia.effect.glDreamyVision;

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

    var fuzzinessButton = $.getMenu().addSliderAttribute('Fuzziness', {
      min:0,
      max:1,
      value:1,
      step:0.01,
      slide: function (evt, ui) {
        self.apply(nokia.gl.context, ui.value);
      }
    });

    // Preprocessing: Preprocessed image goes to
    // nokia.gl.textureFiltered a.k.a. "filtered".

    self.shader = nokia.gl.setupShaderProgram(nokia.gl.context, effectName);
    self.apply(nokia.gl.context, 1.0);

    // Bring up the Fuzziness slider to give a hint to the user

    fuzzinessButton.click();
  };

  self.prototype.uninit = function() {
    console.log(effectName + " uninit");
  };

  ///////////////////////////////////////////////////////////////////////////////////////
  // WebGL drawing code
  //

  self.apply = function (gl, alpha) {

    console.log(effectName + " apply");

	  var uniforms = { "resolution" : [nokia.gl.width, nokia.gl.height], 
		                 "alpha"      : alpha,
		                 "src"        : nokia.gl.textureOriginal };

	  nokia.gl.renderToTexture(gl, nokia.gl.textureFiltered, self.shader, uniforms);
    nokia.Effect.glPaint();
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
