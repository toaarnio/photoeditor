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
 * WebGL recolorize effect.
 *
 * @author Tomi Aarnio
 */

goog.require('nokia.gl');
goog.require('nokia.utils');
goog.require('nokia.Effect');
goog.require('nokia.EffectManager');

goog.provide('nokia.effect.glRecolorize');

(function($, nokia) {

  /************************
   *
   *   CLASS DEFINITION
   *
   ***********************/

  nokia.effect.glRecolorize = function () {
    nokia.Effect.call(this);
  };

  goog.inherits(nokia.effect.glRecolorize, nokia.Effect);

  /************************
   *
   *   GLOBAL VARIABLES
   *
   ***********************/

  var ENABLED = true;
  var effectName = "Recolorize";
  var kernelURI = "shaders/recolorize.gl";
  var self = nokia.effect.glRecolorize;

  /**
   * The Effect initializer, called upon clicking 'Recolorize' on the
   * 'Effects' menu.  At this point, we need to set up any menu items
   * that are specific to this particular effect; controls that are
   * common to all effects are already set up by the Effect base
   * class.  This is also a good opportunity to do full-framqe
   * preprocessing on the source image.
   */
  self.prototype.init = function() {

    console.log(effectName + " init");

    self.hue = 0.5*3.14159;
    self.saturation = 1.0;
    self.lightness = 1.0;

    self.shader = nokia.gl.setupShaderProgram(nokia.gl.context, effectName);

    var hueButton = $.getMenu().addSliderAttribute('Hue', {
      min   : 0,
      max   : 2.0*3.14159,
      value : self.hue,
      step  : 0.01
    });

    var saturationButton = $.getMenu().addSliderAttribute('Saturation', {
      min   : 0,
      max   : 2,
      value : self.saturation,
      step  : 0.01
    });

    var hueFunc = function (evt, ui) {
      self.hue = ui.value;
      self.apply(nokia.gl.context, self.hue, self.saturation, self.lightness);
    };

    var saturationFunc = function (evt, ui) {
      self.saturation = ui.value;
      self.apply(nokia.gl.context, self.hue, self.saturation, self.lightness);
    };

    // Preprocess & measure speed

    nokia.utils.Timer.start("Recolorize");
    self.apply(nokia.gl.context, self.hue, self.saturation, self.lightness);
    var isInteractiveSpeed = nokia.utils.Timer.elapsed("Recolorize", true) < 20 ? true : false;
    var hueSliderContainer = hueButton.data("attributeContainer").children();
    hueSliderContainer.bind(isInteractiveSpeed? "slide" : "slidechange", hueFunc);
    var saturationSliderContainer = saturationButton.data("attributeContainer").children();
    saturationSliderContainer.bind(isInteractiveSpeed? "slide" : "slidechange", saturationFunc);

    // Bring up the Hue adjustment slider

    hueButton.click();
  };

  self.prototype.uninit = function() {
    console.log(effectName + " uninit");
  };

  ///////////////////////////////////////////////////////////////////////////////////////
  // WebGL drawing code
  //
  self.apply = function (gl, hue, saturation, lightness) {

    console.log(effectName + " apply");

    var uniforms = { "resolution" : [nokia.gl.width, nokia.gl.height], 
                     "src"  : nokia.gl.textureOriginal,
                     "hsv"  : [hue, saturation, lightness] };

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
