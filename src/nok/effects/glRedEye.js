/**
 * WebGL red eye removing effect.
 *
 * @author Tomi Aarnio
 */

goog.require('nokia.gl');
goog.require('nokia.utils');
goog.require('nokia.Effect');
goog.require('nokia.EffectManager');

goog.provide('nokia.effect.glRedEye');

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
  nokia.effect.glRedEye = function () {
    nokia.Effect.call(this);
    self = this;
    console.log('glRedEye constructor.');
  };

  goog.inherits(nokia.effect.glRedEye, nokia.Effect);

  /**
   * Effect initializer, called upon clicking 'Red Eye' on
   * the 'Effects' menu.  At this point, we need to set up any
   * menu items other than 'Undo', 'Apply' and 'Cancel' which
   * are provided by the Effect base class.  This is also a good
   * opportunity to do full-frame preprocessing on the source
   * image.
   */
  nokia.effect.glRedEye.prototype.init = function() {

    console.log("glRedEye init");

    // Preprocessed image goes to nokia.gl.textureFiltered
    // a.k.a. "filtered".

    // Set up the WebGL shader
    
    self.glShaderRedEye = nokia.gl.setupShaderProgram(nokia.gl.context, "redeye");

    // Use an inverted brush mask for this effect. Also make the
    // default brush size smaller than usual.

    $.invertMaskTexture = true;
    $.brushTargetAlpha = 1.0;
    $.brushRadiusNominal = $.brushRadiusNominal / 2;
    $.brushRadius = $.brushRadiusNominal;

    // Measure preprocessing speed

    nokia.utils.Timer.start("RedEye");
    nokia.effect.glRedEye.preprocess(nokia.gl.context);
    nokia.gl.context.finish();
    var isInteractiveSpeed = nokia.utils.Timer.elapsed("RedEye", true) < 20 ? true : false;
  };

  /**
   * uninit
   */
  nokia.effect.glRedEye.prototype.uninit = function() {
    console.log("glRedEye uninit");
  };

  ///////////////////////////////////////////////////////////////////////////////////////
  // WebGL drawing code
  //
  nokia.effect.glRedEye.preprocess = function (gl) {
    console.log("nokia.effect.glRedEye.preprocess");

    var uniforms = { "resolution" : [nokia.gl.width, nokia.gl.height], 
                     "src"  : nokia.gl.textureOriginal };

    nokia.gl.renderToTexture(nokia.gl.context, nokia.gl.textureFiltered, self.glShaderRedEye, uniforms);

    // The filtered image remains on the screen after renderToTexture.
    // However, red eye removal works better if we let the user start
    // painting out the red eyes, rather than painting in the rest of
    // the image.

    nokia.Effect.glPaint();
  };

  ///////////////////////////////////////////////////////////////////////////////////////
  // Effect registration
  //
  nokia.EffectManager.register('Fix Red Eyes', nokia.effect.glRedEye);

})(jQuery, nokia);
