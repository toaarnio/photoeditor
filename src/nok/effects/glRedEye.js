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
 * WebGL red eye removing filter. Actually it removes pretty much all
 * red areas in the image, with the assumption that the user will only
 * paint the eye regions.
 *
 * @author Tomi Aarnio
 */

goog.require('nokia.gl');
goog.require('nokia.utils');
goog.require('nokia.Effect');
goog.require('nokia.EffectManager');

goog.provide('nokia.effect.glRedEye');

(function($, nokia) {

  /************************
   *
   *   CLASS DEFINITION
   *
   ***********************/

  nokia.effect.glRedEye = function () {
    nokia.Effect.call(this);
  };
    
  goog.inherits(nokia.effect.glRedEye, nokia.Effect);
  
  /************************
   *
   *   GLOBAL VARIABLES
   *
   ***********************/

  var ENABLED = true;
  var effectName = "Fix Red Eyes";
  var kernelURI = "shaders/redeye.gl";
  var self = nokia.effect.glRedEye;

  /**
   * Effect initializer, called upon clicking 'Fix Red Eyes' on
   * the 'Effects' menu.  At this point, we need to set up any
   * menu items other than 'Undo', 'Apply' and 'Cancel' which
   * are provided by the Effect base class.  This is also a good
   * opportunity to do full-frame preprocessing on the source
   * image.
   */
  self.prototype.init = function() {

    console.log(effectName + " init");

    // Set up the WebGL shader
    
    self.shader = nokia.gl.setupShaderProgram(nokia.gl.context, effectName);

    // Use an inverted brush mask for this effect.

    $.invertMaskTexture = true;
    $.brushTargetAlpha = 1.0;

    // Measure preprocessing speed

    nokia.utils.Timer.start("RedEye");
    self.apply(nokia.gl.context);
    var isInteractiveSpeed = nokia.utils.Timer.elapsed("RedEye", true) < 20 ? true : false;
    nokia.gl.context.finish();
  };

  self.prototype.uninit = function() {
    console.log(effectName + " uninit");
  };

  ///////////////////////////////////////////////////////////////////////////////////////
  // WebGL drawing code
  //

  self.apply = function (gl) {

    console.log(effectName + " apply");

    var uniforms = { "resolution" : [nokia.gl.width, nokia.gl.height], 
                     "src"  : nokia.gl.textureOriginal };

    nokia.gl.renderToTexture(nokia.gl.context, nokia.gl.textureFiltered, self.shader, uniforms);

    // The filtered image remains on the screen after renderToTexture.
    // However, red eye removal works better if we let the user start
    // painting out the red eyes, rather than painting in the rest of
    // the image.

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
