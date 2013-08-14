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
 * Effect base class
 *
 * @author Tomi Aarnio, Nokia Research Tampere, 2011
 */

goog.provide('nokia.Effect');

goog.provide('nokia.EffectManager');

(function ($) {

  /**
   * @namespace 
   *
   * Created when the user goes to the Effect submenu.
   */

  nokia.Effect = function() {
  };

  /**
   * @private
   */

  nokia.Effect.prototype._init = function() {
    var self = this;
    var gl = nokia.gl.context;
    glu = nokia.glu;

    // Set up global variables (must be done before rendering)

    $.zoomAspectRatio = nokia.gl.width / nokia.gl.height;
    $.zoomWidth = nokia.gl.width;
    $.zoomHeight = nokia.gl.height;
    $.zoomCenterX = nokia.gl.width/2;
    $.zoomCenterY = nokia.gl.height/2;
    $.zoomBottomLeftX = 0;
    $.zoomBottomLeftY = 0;
    $.zoomRatio = $.zoomWidth / nokia.gl.width;

    $.brushRadiusNominal = Math.min(nokia.gl.width, nokia.gl.height) / 10;
    $.brushRadius = $.brushRadiusNominal;
    $.brushTargetAlpha = 1.0;
    $.invertMaskTexture = false;

    self.screenWidth = $.getCanvasObject().width();
    self.screenHeight = $.getCanvasObject().height();
    self.redraw = false;

    // Call the effect's own initializer first

    this.init();

    /*****************************************************************
     * Here's how to create a menu button with an associated slider
     * in "full manual" mode, to really understand what's going on.
     ****************************************************************/

    if (false) {

      // 1. Create a slider

      var fooSlider = $('<div/>').slider({
        id: 'zoomSlider',
        min: -nokia.gl.width,
        max: -Math.max(self.screenWidth/10, nokia.gl.width/50),
        value: -nokia.gl.width,
        orientation: 'vertical',
        range: 'min',
        step: 1,
        slide : function (evt, ui) {
          console.log("Foobar.slide called: ", ui.value);
        }
      });

      // 2. Create a container for the slider (for decoration)

      var fooSliderContainer = $('<div/>');
      fooSliderContainer.addClass("ui-widget ui-state-default ui-widget-content ui-corner-all");
      fooSliderContainer.css({ padding: 15 });
      fooSliderContainer.hide();

      // 3. Insert the slider & its container into the DOM tree

      var allSlidersContainer = $('#attributeContainer');
      fooSliderContainer.appendTo(allSlidersContainer);
      fooSlider.appendTo(fooSliderContainer);

      // 4. Create a menu button associated with the slider

      var fooButton = $('#menu').addToggleMenuButton('Foobar');
      fooButton.addClass('attribute-slider-button');

      // 5. Associate the menu button with the slider
      
      fooButton.data('attributeContainer', fooSliderContainer);

      // 6. Make button clicks to hide/show the slider

      fooButton.bind("click", function() {
        if ($(this).buttonValue()) {
          $(this).data('attributeContainer').show();
          var buttonSelf = this;
          $('.attribute-slider-button').each(function() {
            if (this !== buttonSelf) {
              $(this).buttonValue(false);
              if ($(this).data('attributeContainer')) {
                $(this).data('attributeContainer').hide();
              }
            }
          });
        } else {
          $(this).data('attributeContainer').hide();
        }
      });

      // 7. DONE!
    }

    // Zoom & Pan

    nokia.Effect.zoomButton = $.getMenu().addSliderAttribute('Zoom & Pan', {
      id: 'zoomSlider',
      min: -nokia.gl.width,
      max: -Math.max(self.screenWidth/10, nokia.gl.width/50),
      value: -nokia.gl.width,
      orientation: 'vertical',
      range: 'min',
      step: 1
    });

    var zoomSliderFunc = function (evt, ui) {
      $.zoomWidth = -ui.value;
      $.zoomHeight = $.zoomWidth / $.zoomAspectRatio;
      $.zoomRatio = $.zoomWidth / nokia.gl.width;
      $.brushRadius = $.brushRadiusNominal * $.zoomRatio;
      nokia.Effect.glPaint();
    };

    var sliderContainer = nokia.Effect.zoomButton.data("attributeContainer").children();
    sliderContainer.bind("slide", zoomSliderFunc);

    // Brush Size

    $.getMenu().addSliderAttribute('Brush Size', {
      min   : 2,
      max   : $.brushRadiusNominal * 2.5,
      value : $.brushRadiusNominal,
      step  : 2,
      range : 'min',
      slide : function (evt, ui) {
        $.brushRadiusNominal = ui.value;
        $.brushRadius = ui.value * $.zoomRatio;
      }
    });

    // Invert Brush -- inverts the brush so that it paints "back in"

    $.getMenu().addMenuButton('Invert Brush').click(function() {
      console.log("'Invert Brush' pressed");
      $.brushTargetAlpha = 1.0 - $.brushTargetAlpha;
      //nokia.Effect.zoomButton.hideAttributeView();
      nokia.Effect.glPaint();
    });

    // Invert Mask -- inverts the mask texture

    $.getMenu().addMenuButton('Invert Mask').click(function() {
      console.log("'Invert Mask' pressed");
      $.invertMaskTexture = ($.invertMaskTexture === true) ? false : true;
      //nokia.Effect.zoomButton.hideAttributeView();
      nokia.Effect.glPaint();
    });

    // Before/After -- render the original image or the edited image

    self.showBeforeImage = true;
    $.getMenu().addMenuButton('Before/After').click(function() {
      console.log("'Before/After' pressed");
      if (self.showBeforeImage === true) {
        nokia.Effect.glPaintTexture(nokia.gl.textureOriginal);
        self.showBeforeImage = false;
      } else {
        nokia.Effect.glPaint();
        self.showBeforeImage = true;
      }
    });

    // Undo -- clear the paint mask, then redraw and continue as usual

    $.getMenu().addMenuButton('Undo').click(function() {
      console.log("'Undo' pressed");
      glu.clearTexture(nokia.gl.textureBrushMask);
      nokia.Effect.glPaint();
    }).button('option', 'icons', {primary: 'ui-icon-circle-close'});

    // Cancel -- discard the result texture, return to the Effects menu

    $.getMenu().addMenuButton('Cancel').click(function() {
      console.log("'Cancel' pressed");
      self._uninit();
      
      glu.clearTexture(nokia.gl.textureBrushMask);
      glu.drawDefault(nokia.gl.textureOriginal);

      $.getMenu().clearMenu();
      $.getMenu().effectsMenu();
    }).button('option', 'icons', {primary: 'ui-icon-circle-close'});

    // Apply -- swap textures, return to Effects menu

    $.getMenu().addMenuButton('Apply').click(function() {
      console.log("'Apply' pressed");

      console.log("  render the edited image in full size (not zoomed) to the framebuffer.");

      glu.drawZoomBlended(nokia.gl.textureFiltered,
                          nokia.gl.textureOriginal,
                          nokia.gl.textureBrushMask,
                          $.invertMaskTexture,
                          0,
                          0,
                          nokia.gl.width,
                          nokia.gl.height);

      console.log("  copyTexImage2D from framebuffer to nokia.gl.texturePainted.");

      var gl = nokia.gl.context;
      glu.bindTextures(nokia.gl.texturePainted);
      gl.activeTexture(gl.TEXTURE0);
      gl.copyTexImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 0, 0, nokia.gl.width, nokia.gl.height, 0);

      var orig = nokia.gl.textureOriginal;
      nokia.gl.textureOriginal = nokia.gl.texturePainted;
      nokia.gl.texturePainted = orig;
      nokia.gl.textureOriginal.name = "original";
      nokia.gl.texturePainted.name = "painted";
      glu.clearTexture(nokia.gl.textureBrushMask);

      self._uninit();
      $.setDirty();
      $.getMenu().clearMenu();
      $.getMenu().effectsMenu();
    }).button('option', 'icons', {primary: 'ui-icon-circle-check'});

    // WebCL device selection slider
    
    if (self.initCL) {

      var deviceSelectButton = $.getMenu().addSliderAttribute('WebCL Device', {
        min   : 0,
        max   : nokia.cl.numContexts-1,
        value : nokia.cl.ctxIndex,
        step  : 1
      });

      var deviceSelectFunc = function (evt, ui) {
        self.initCL(ui.value);
        self.apply(nokia.gl.textureFiltered);
        nokia.Effect.glPaint();
      };

      var sliderContainer = deviceSelectButton.data("attributeContainer").children();
      sliderContainer.bind("slidechange", deviceSelectFunc);
    }

    // Grab local handles to the buttons. This lets us query and
    // modify their state quickly, without having to find them 
    // from the DOM tree every time.

    nokia.Effect.brushSizeButton = $.getMenu().find('button:contains(Brush Size)');
    nokia.Effect.brushInvertButton = $.getMenu().find('button:contains(Invert Brush)');
    nokia.Effect.invertMaskButton = $.getMenu().find('button:contains(Invert Mask)');
    //nokia.Effect.zoomButton = $.getMenu().find('button:contains(Zoom & Pan)');
    nokia.Effect.undoButton = $.getMenu().find('button:contains(Undo)');
    nokia.Effect.cancelButton = $.getMenu().find('button:contains(Cancel)');
    nokia.Effect.beforeAfterButton = $.getMenu().find('button:contains(Before/After)');
    nokia.Effect.applyButton = $.getMenu().find('button:contains(Apply)');

    // Set up mouse event handlers

    nokia.Effect.clearMouseEvents();
    $("#canvas3d").bind('mousedown', nokia.Effect.onmousedown);
    $("#wholepage").bind('mousemove', nokia.Effect.onmousemove);
    $("#wholepage").bind('mouseup', nokia.Effect.onmouseup);
    $("#wholepage").bind('mousewheel', nokia.Effect.onmousewheel);

  };

  /**
   * @private
   */

  nokia.Effect.prototype._uninit = function() {

    this.uninit();
    
    // Clear mouse handlers

    $("#canvas3d").unbind('mousedown');
    $("#wholepage").unbind('mousemove');
    $("#wholepage").unbind('mouseup');

    // Clear attribute container.

    $('*', $.getAttributes()).remove();
  };

  ///////////////////////////////////////////////////////////////////////////////////////
  // Mouse event handling & redrawing for the Paint Mode
  //

  /**
   * Updates the brush alpha mask texture with a circular brush.  Uses
   * the built-in shader "brush" and the built-in texture
   * <tt>nokia.gl.textureBrushMask</tt>.  Note that the same texture
   * is used for both input and output.  The brush coordinates are
   * given relative to the bottom left of the image (which is the
   * texture space origin in WebGL).
   * 
   * @param {Float} brushX the X coordinate of the brush center
   * @param {Float} brushY the Y coordinate of the brush center
   * @param {Float} brushRadius the radius of the brush, in pixels
   * @param {Float} targetAlpha the alpha value to saturate towards
   */
  nokia.Effect.glUpdateBrushMask = function (brushX, brushY, brushRadius, targetAlpha) {

    var uniforms = { "resolution"  : [nokia.gl.width, nokia.gl.height], 
                     "mouse"       : [brushX, brushY, 0, 0],
                     "brushRadius" : brushRadius,
                     "targetAlpha" : targetAlpha,
                     "mask"        : nokia.gl.textureBrushMask };

    glu.renderToTexture(nokia.gl.textureBrushMask,
                        nokia.gl.shaders["brush"],
                        uniforms);
  };

  nokia.Effect.glPaint = function() {

    //console.log("glPaint()");

    // Derive zoom window bottom left coordinates from the given
    // center coordinates, making sure that the zoom window does
    // not fall beyond the texture borders.  All coordinates are
    // relative to the bottom left corner of the image, which is
    // the texture-space origin in WebGL.

    $.zoomBottomLeftX = $.zoomCenterX - $.zoomWidth / 2;
    $.zoomBottomLeftY = $.zoomCenterY - $.zoomHeight / 2;
    $.zoomBottomLeftX = clamp($.zoomBottomLeftX, 0, nokia.gl.width-$.zoomWidth);
    $.zoomBottomLeftY = clamp($.zoomBottomLeftY, 0, nokia.gl.height-$.zoomHeight);

    // Draw the selected area of the image, zoomed in/out to fit
    // the canvas. The original texture is blended with the pre-
    // processed texture according to the (user-generated) paint 
    // mask.

    glu.drawZoomBlended(nokia.gl.textureFiltered,
                        nokia.gl.textureOriginal,
                        nokia.gl.textureBrushMask,
                        $.invertMaskTexture,
                        $.zoomBottomLeftX,
                        $.zoomBottomLeftY,
                        $.zoomWidth,
                        $.zoomHeight);
  };

  nokia.Effect.glPaintTexture = function(texture) {
    $.zoomBottomLeftX = $.zoomCenterX - $.zoomWidth / 2;
    $.zoomBottomLeftY = $.zoomCenterY - $.zoomHeight / 2;
    $.zoomBottomLeftX = clamp($.zoomBottomLeftX, 0, nokia.gl.width-$.zoomWidth);
    $.zoomBottomLeftY = clamp($.zoomBottomLeftY, 0, nokia.gl.height-$.zoomHeight);
    glu.drawZoomed(texture,
                   $.zoomBottomLeftX,
                   $.zoomBottomLeftY,
                   $.zoomWidth,
                   $.zoomHeight);
  };

  // Maps the given screen coordinates to texture coordinates. The screen space
  // and texture space origins are assumed to be in the upper left and bottom
  // left corners of the image, respectively. In other words, the Y coordinate
  // is inverted when going from screen space to texture space.

  nokia.Effect.mapCanvasCoordsToTexture = 
    function(screenX, screenY, screenW, screenH, zoomX, zoomY, zoomW, zoomH) {

    var zoomWindowToScreenRatioX = zoomW / screenW;  // for example, 2048 / 800 = 2.56
    var zoomWindowToScreenRatioY = zoomH / screenH;  // usually the same as the X ratio
    var windowX = screenX * zoomWindowToScreenRatioX;
    var windowY = (screenH-screenY) * zoomWindowToScreenRatioY;
    var textureX = zoomX + windowX;
    var textureY = zoomY + windowY;
    //console.log("mapCanvasCoordsToTexture:");
    //console.log("  screenX,Y = ", screenX, ", ", screenH-screenY);
    //console.log("  screenW,H = ", screenW, ", ", screenH);
    //console.log("  zoomX,Y = ", zoomX, ", ", zoomY);
    //console.log("  zoomW,H = ", zoomW, ", ", zoomH);
    //console.log("  textureX,Y = ", textureX, ", ", textureY);
    return [textureX, textureY];
  };

  clamp = function(value, lo, hi) {
    return Math.min(Math.max(value, lo), hi);
  };

  nokia.Effect.clearMouseEvents = function() {
    console.log("clearMouseEvents");
    self.mousedown = false;
  };

  nokia.Effect.onmousewheel = function(ev) {

    // Mouse wheel rotated over the canvas? Bail out if not.

    if (ev.target == nokia.gl.canvas) {

      // Get the on-screen canvas dimensions. This needs to be
      // done dynamically rather than at initialization, because
      // the dimensions may be changed by the user's actions in
      // the browser (such as resizing the browser window).

      self.canvasScreenWidth = $.getCanvasObject().width();
      self.canvasScreenHeight = $.getCanvasObject().height();

      // Compute mouse position relative to the canvas. That is the
      // center point that we zoom towards.

      var mouseCanvasXY = 
        nokia.utils.mapPageCoordsToElement(nokia.gl.canvas, ev.pageX, ev.pageY);

      console.log("mouseCanvasXY: ", mouseCanvasXY);

      // Map the mouse position from the screen-space canvas
      // to WebGL texture coordinates (which are inverted in
      // the Y direction).

      var mouseTextureXY = 
        nokia.Effect.mapCanvasCoordsToTexture(mouseCanvasXY[0],
                                              mouseCanvasXY[1],
                                              self.canvasScreenWidth,
                                              self.canvasScreenHeight,
                                              $.zoomBottomLeftX,
                                              $.zoomBottomLeftY,
                                              $.zoomWidth,
                                              $.zoomHeight);

      self.zoomTargetX = mouseTextureXY[0];
      self.zoomTargetY = mouseTextureXY[1];

      // The mouse position becomes the new zoom center point,
      // which we start gravitating towards.

      $.zoomCenterX = mouseTextureXY[0];
      $.zoomCenterY = mouseTextureXY[1];
      
      console.log("zoomCenter: ", mouseTextureXY);

      // Switch to the zoom & pan mode if it's not already enabled.

      self.panningEnabled = nokia.Effect.zoomButton.buttonValue();
      if (self.panningEnabled === false) {
        nokia.Effect.zoomButton.click();
        self.panningEnabled = true;
      }

      // Set new zoom window size

      var delta = ev.wheelDelta ? ev.wheelDelta/120 : (ev.detail ? -ev.detail/3 : 0);
      var minZoomWidth = Math.max(self.canvasScreenWidth/10, nokia.gl.width/50);
      $.zoomWidth = clamp($.zoomWidth - delta * nokia.gl.width/20, minZoomWidth, nokia.gl.width);
      $.zoomHeight = $.zoomWidth / $.zoomAspectRatio;
      $.zoomRatio = $.zoomWidth / nokia.gl.width;
      $.brushRadius = $.brushRadiusNominal * $.zoomRatio;

      // Trigger a zoom slider 'slide' event to effect the change and
      // to bring up the slider if necessary.

      var zoomSlider = nokia.Effect.zoomButton.data("slider");
      zoomSlider.slider('value', -$.zoomWidth);
      zoomSlider.trigger('slide', [{ value: -$.zoomWidth }]);
    }
  };

  nokia.Effect.onmousedown = function(ev) {

    // Left mouse button pressed over the canvas? Bail out if not.

    if (ev.which == 1 && ev.target == nokia.gl.canvas) {  
      
      // Indicate to the "mouse move" handler that the mouse is down.
      
      self.mousedown = true;

      // Check whether the zoom & pan mode is currently enabled.
      // Take a local copy of the status flag for faster and more
      // convenient access.

      self.panningEnabled = nokia.Effect.zoomButton.buttonValue();

      // Get the on-screen canvas dimensions. This needs to be
      // done dynamically rather than at initialization, because
      // the dimensions may be changed by the user's actions in
      // the browser.

      self.canvasScreenWidth = $.getCanvasObject().width();
      self.canvasScreenHeight = $.getCanvasObject().height();

      // Map the mouse position from screen space to Canvas.
      // Note that this is the canvas as shown on the screen,
      // which is typically not the same size as the canvas back
      // buffer.

      var mouseCanvasXY = 
        nokia.utils.mapPageCoordsToElement(nokia.gl.canvas, ev.pageX, ev.pageY);

      // Map the mouse position from the screen-space canvas
      // to WebGL texture coordinates (which are inverted in
      // the Y direction).

      var mouseTextureXY = 
        nokia.Effect.mapCanvasCoordsToTexture(mouseCanvasXY[0],
                                              mouseCanvasXY[1],
                                              self.canvasScreenWidth,
                                              self.canvasScreenHeight,
                                              $.zoomBottomLeftX,
                                              $.zoomBottomLeftY,
                                              $.zoomWidth,
                                              $.zoomHeight);
      self.mouseOrigX = mouseTextureXY[0];
      self.mouseOrigY = mouseTextureXY[1];
      self.zoomCenterOrigX = $.zoomCenterX;
      self.zoomCenterOrigY = $.zoomCenterY;

      // Derive zoom window bottom left coordinates from the given
      // center coordinates, making sure that the zoom window does
      // not fall beyond the texture borders.  All coordinates are
      // relative to the bottom left corner of the image, which is
      // the texture-space origin in WebGL.

      self.zoomOrigBottomLeftX = $.zoomCenterX - $.zoomWidth / 2;
      self.zoomOrigBottomLeftY = $.zoomCenterY - $.zoomHeight / 2;
      self.zoomOrigBottomLeftX = clamp(self.zoomOrigBottomLeftX, 0, nokia.gl.width-$.zoomWidth);
      self.zoomOrigBottomLeftY = clamp(self.zoomOrigBottomLeftY, 0, nokia.gl.height-$.zoomHeight);
      //console.log("zoomOrigBottomLeftX, Y = ", self.zoomOrigBottomLeftX, self.zoomOrigBottomLeftY);

      if (self.panningEnabled === true) {
        console.log("Panning mode initiated.");
      }

      if (self.panningEnabled === false) {
        console.log("Paint mode initiated.");
        nokia.Effect.glUpdateBrushMask(self.mouseOrigX, self.mouseOrigY, $.brushRadius, $.brushTargetAlpha);
        nokia.Effect.glPaint();
      }
    }
  };

  nokia.Effect.onmousemove = function(ev) {

    if (self.mousedown === true) {

      var mouseCanvasXY =
        nokia.utils.mapPageCoordsToElement(nokia.gl.canvas, ev.pageX, ev.pageY);

      if (self.panningEnabled === true) {

        var mouseTextureXY =
          nokia.Effect.mapCanvasCoordsToTexture(mouseCanvasXY[0], 
                                                mouseCanvasXY[1],
                                                self.canvasScreenWidth,
                                                self.canvasScreenHeight,
                                                self.zoomOrigBottomLeftX,
                                                self.zoomOrigBottomLeftY,
                                                $.zoomWidth,
                                                $.zoomHeight);

        var vectorX = mouseTextureXY[0] - self.mouseOrigX;
        var vectorY = mouseTextureXY[1] - self.mouseOrigY;
        $.zoomCenterX = clamp(self.zoomCenterOrigX - vectorX, 0, nokia.gl.width);
        $.zoomCenterY = clamp(self.zoomCenterOrigY - vectorY, 0, nokia.gl.height);
        nokia.Effect.glPaint();
      }
      
      if (self.panningEnabled === false) {

        var centerXY = nokia.Effect.mapCanvasCoordsToTexture(mouseCanvasXY[0], 
                                                             mouseCanvasXY[1],
                                                             self.canvasScreenWidth,
                                                             self.canvasScreenHeight,
                                                             $.zoomBottomLeftX,
                                                             $.zoomBottomLeftY,
                                                             $.zoomWidth,
                                                             $.zoomHeight);

        nokia.Effect.glUpdateBrushMask(centerXY[0], centerXY[1], $.brushRadius, $.brushTargetAlpha);
        nokia.Effect.glPaint();
      }
    }
  };

  nokia.Effect.onmouseup = function(ev) {
    self.mousedown = false;
  };

  // ====================
  // = Public functions =
  // ====================

  /**
   * Called when the user activates current effect.
   *
   * @return none
   */

  nokia.Effect.prototype.init = function(container) {
    // Need to override!

    return null;
  };

  /**
   * Called when the user exits the current effect.
   *
   * @return none
   */

  nokia.Effect.prototype.uninit = function() {
    // Need to override!

    return null;
  };

  // ==================
  // = Effect manager =
  // ==================

  /**
   * @namespace
   *
   * Effects management system. Used for registering effects. 
   *
   */
  nokia.EffectManager = {};

  /**
   * Object of available effects.
   */

  nokia.EffectManager.effects = {};

  /**
   * Registers available effects.
   *
   * @param name name of the effect
   * @param effect Class of the effect
   *
   * @return none
   */

  nokia.EffectManager.register = function (name, effect) {
    console.log('registering effect', name);
    
    nokia.EffectManager.effects[name] = effect;
    
    return null;
  };
  
})(jQuery);
