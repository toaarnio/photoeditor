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
  nokia.effect.glRecolorize = function () {
    nokia.Effect.call(this);
    self = this;
    console.log('glRecolorize constructor.');
  };

  goog.inherits(nokia.effect.glRecolorize, nokia.Effect);

  /**
   * The Effect initializer, called upon clicking 'Recolorize' on the
   * 'Effects' menu.  At this point, we need to set up any menu items
   * that are specific to this particular effect; controls that are
   * common to all effects are already set up by the Effect base
   * class.  This is also a good opportunity to do full-framqe
   * preprocessing on the source image.
   */
  nokia.effect.glRecolorize.prototype.init = function() {

    console.log("glRecolorize init");

    // Preprocessed image goes to nokia.gl.textureFiltered

    self.hue = 0.5*3.14159;
    self.saturation = 1.0;
    self.lightness = 1.0;

    // Set up the WebGL shader
    
    self.glShaderRecolorize = nokia.gl.setupShaderProgram(nokia.gl.context, "recolorize");

    // Set up effect-specific buttons and sliders

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
      nokia.effect.glRecolorize.preprocess(nokia.gl.context, self.hue, self.saturation, self.lightness);
      nokia.Effect.glPaint();
    };

    var saturationFunc = function (evt, ui) {
      self.saturation = ui.value;
      nokia.effect.glRecolorize.preprocess(nokia.gl.context, self.hue, self.saturation, self.lightness);
      nokia.Effect.glPaint();
    };

    // Measure preprocessing speed

    nokia.utils.Timer.start("Recolorize");
    nokia.effect.glRecolorize.preprocess(nokia.gl.context, self.hue, self.saturation, self.lightness);
    nokia.gl.context.finish();
    var isInteractiveSpeed = nokia.utils.Timer.elapsed("Recolorize", true) < 20 ? true : false;
    var hueSliderContainer = hueButton.data("attributeContainer").children();
    hueSliderContainer.bind(isInteractiveSpeed? "slide" : "slidechange", hueFunc);
    var saturationSliderContainer = saturationButton.data("attributeContainer").children();
    saturationSliderContainer.bind(isInteractiveSpeed? "slide" : "slidechange", saturationFunc);

    // Bring up the hue adjustment slider

    hueButton.click();
  };

  /**
   * uninit
   */
  nokia.effect.glRecolorize.prototype.uninit = function() {
    console.log("glRecolorize uninit");
  };

  ///////////////////////////////////////////////////////////////////////////////////////
  // WebGL drawing code
  //
  nokia.effect.glRecolorize.preprocess = function (gl, hue, saturation, lightness) {
    console.log("nokia.effect.glRecolorize.preprocess: ", hue, saturation, lightness);

    var uniforms = { "resolution" : [nokia.gl.width, nokia.gl.height], 
                     "src"  : nokia.gl.textureOriginal,
                     "hsv"  : [hue, saturation, lightness] };

    nokia.gl.renderToTexture(gl, nokia.gl.textureFiltered, self.glShaderRecolorize, uniforms);
  };

  ///////////////////////////////////////////////////////////////////////////////////////
  // Effect registration
  //
  nokia.EffectManager.register('Recolorize', nokia.effect.glRecolorize);

})(jQuery, nokia);
