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
 * WebGL "Night Vision" effect.
 *
 * @author Tomi Aarnio
 */

goog.require('nokia.gl');
goog.require('nokia.utils');
goog.require('nokia.Effect');
goog.require('nokia.EffectManager');

goog.provide('nokia.effect.glNightVision');

(function($, nokia) {

  // ====================
  // = Global variables =
  // ====================

  var self;

  // ===============
  // = Constructor =
  // ===============
  
  /**
   * Effect constructor, called upon entering the 'Effects'
   * menu.  At this point, the image to be edited is already
   * known.
   */
  nokia.effect.glNightVision = function () {
    nokia.Effect.call(this);

    self = this;

    console.log('glNightVision constructor.');

  };
  goog.inherits(nokia.effect.glNightVision, nokia.Effect);

  /**
   * Effect initializer, called upon selecting the effect on
   * the 'Effects' menu.  At this point, we need to set up any
   * menu items other than 'Undo', 'Apply' and 'Cancel' which
   * are provided by the Effect base class.  This is also a good
   * opportunity to do full-frame preprocessing on the source
   * image.
   */
  nokia.effect.glNightVision.prototype.init = function() {

    console.log("glNightVision init");

    var ampButton = $.getMenu().addSliderAttribute('Amplification', {
      min:0,
      max:1,
      value:0.5,
      step:0.01,
      slide: function (evt, ui) {
        nokia.effect.glNightVision.apply(nokia.gl.context, ui.value);
		    nokia.Effect.glPaint();
      }
    });
    
    // Preprocessing: Preprocessed image goes to
    // nokia.gl.textureFiltered a.k.a. "filtered".

    self.glShaderNightVision = nokia.gl.setupShaderProgram(nokia.gl.context, "nightvision");
    nokia.effect.glNightVision.apply(nokia.gl.context, 0.5);
    nokia.Effect.glPaint();

    // Bring up the Amplification slider to give a hint to the user

    ampButton.click();
  };

  /**
   * uninit
   */

  nokia.effect.glNightVision.prototype.uninit = function() {
	  console.log("glNightVision uninit");
  };

  ///////////////////////////////////////////////////////////////////////////////////////
  // WebGL drawing code
  //

  nokia.effect.glNightVision.apply = function (gl, alpha) {
    console.log("nokia.effect.glNightVision.apply");

	  var time = ((new Date().getTime() % 500) / 250) - 1;
    
	  var uniforms = { "resolution" : [nokia.gl.width, nokia.gl.height], 
		                 "alpha"      : alpha,
			               "random"     : time,
		                 "src"        : nokia.gl.textureOriginal };

	  nokia.gl.renderToTexture(gl, nokia.gl.textureFiltered, self.glShaderNightVision, uniforms);
  };

  ///////////////////////////////////////////////////////////////////////////////////////
  // Effect registration
  //
  nokia.EffectManager.register('Night Vision', nokia.effect.glNightVision);

})(jQuery, nokia);
