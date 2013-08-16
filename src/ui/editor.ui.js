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
 * Image editor main window.
 *
 * @author Timo Reunanen, 2010
 * @author Tomi Aarnio, 2010-
 */

goog.require('nokia.EffectManager');

goog.require('nokia.Storage');
goog.require('nokia.gl');
goog.require('nokia.utils');

(function ($, nokia) {

  /*********************************************************************
   *
   * GLOBAL VARIABLES
   *
   ********************************************************************/

  // Reuse a single <img> element rather than create new ones.  This
  // is to work around known bugs in Firefox and to reduce GC burden
  // in general.

  jQuery.img = (function() { 
    console.log("Creating a new global Image object.");
    return new Image();
  })();

  /*********************************************************************
   *
   * IMAGE EDITOR MAIN WINDOW
   *
   ********************************************************************/
  jQuery.imageEditWindow = function() {

    $.hideMainWindow();        // hide the image browser & scroll bar
    $.clearDirty();            // clear the 'image has been edited' flag

    var container = $('#container');
    var menu = $('#menu');
    if (container[0] !== undefined) {
      $('#canvas3d').hide();  // hide canvas until image has been loaded
      container.show();
      menu.show();
      return;
    }

    console.log("$.imageEditWindow(): creating the editor main view");

    $('<div id="container"/>').appendTo('body');
    $('<div id="attributeContainer"/>').appendTo('#container');
    //$('<div>').id('hidden').appendTo('#container').hide();
    $('#canvas3d').appendTo('#container').addClass('shadow');
    $('#canvas2d').appendTo('#container').addClass('shadow');
    $('<div id="menu"/>').appendTo('body');
    $('#menu').mainMenu();
  };

  /*********************************************************************
   *
   * MAIN MENU
   *
   ********************************************************************/
  jQuery.fn.mainMenu = function () {

    var self = this;
    self.clearMenu();

    // Set up the main menu buttons.  The buttons are regular html
    // <button> elements, except for 'Export' which is actually an
    // anchor (<a>) element containing the image data as a
    // base64-encoded JPEG in its "href" attribute, and the filename
    // in its "download" attribute.

    if  (false) {
      self.saveButton = self.addMenuButton('Save').button('option', 'icons', {primary: 'ui-icon-check'});
      self.saveButton.click(function() {
        var sourceCanvas = $.getCanvasElement();
        $.saveImage(sourceCanvas);
        $.clearDirty();
        $.mainWindow();
      });
    }

    self.exportButton = self.addHrefButton('Export').button('option', 'icons', {primary: 'ui-icon-check'});
    self.exportButton.click(function(event) {
      var imageAsDataURL = $.getCanvasElement().toDataURL('image/jpeg', 0.95);
      var storageName = $.getContainer().data('image-name');
      if (storageName === null) {
        var rnd = Math.floor(Math.random()*1000000000);
        storageName = 'img' + rnd;
      }
      console.log("Exporting a base64-encoded JPEG image (" + storageName + ") for a total of " + imageAsDataURL.length + " bytes.");
      self.exportButton.attr('href', imageAsDataURL);
      self.exportButton.attr('download', storageName);
      $.clearDirty();
    });

    self.effectsButton = self.addMenuButton('Effects').button('option', 'icons', {primary: 'ui-icon-triangle-1-e'});
    self.effectsButton.click(function () {
      self.effectsMenu();
    });

    self.adjustButton = self.addMenuButton('Adjust').button('option', 'icons', {primary: 'ui-icon-triangle-1-e'});
    self.adjustButton.click(function () {
      self.adjustMenu();
    });

    self.backButton = self.addMenuButton('Back').button('option', 'icons', {primary: 'ui-icon-closethick'});
    self.backButton.click(function() {
      if (!$.isDirty() || confirm("Discard all changes?")) {
        $.clearDirty();
        $.mainWindow();
      }
    });

    $(window).bind('beforeunload', function(event) {
      if ($.isDirty()) {
        return "You will lose all unsaved changes."
      }
    });
  };

  /*********************************************************************
   *
   * EFFECTS MENU
   *
   ********************************************************************/
  jQuery.fn.effectsMenu = function () {
    this.clearMenu();

    var self = $(this);

    var effectClasses = nokia.EffectManager.effects;
    var effectList = [];

    for (var effectName in effectClasses) {
      effectList.push(effectName);
    }

    effectList.sort();

    $.each(effectList, function (idx, effectName) {
      var effectClass = effectClasses[effectName];

      // Create instance of effect, so effect can do initialization in constructor.
      var effectInst = new effectClass();

      self.addMenuButton(effectName).click(function () {
        self.clearMenu();
        effectInst._init();
      }).button('option', 'icons', {primary: 'ui-icon-triangle-1-e'});
    });

    this.addMenuButton('Back').click(function () {
      self.mainMenu();
    }).button('option', 'icons', {primary: 'ui-icon-triangle-1-w'});
  };

  /*********************************************************************
   *
   * ADJUST MENU
   *
   ********************************************************************/
  jQuery.fn.adjustMenu = function () {
    this.clearMenu();

    var self = $(this);

    createRotateAttribute.call(this);
    createMirrorAttribute.call(this);
    //createScaleAttribute.call(this); // not very useful, disabled
    createCropAttribute.call(this);

    this.addMenuButton('Back').click(function () {
      self.mainMenu();
    }).button('option', 'icons', {primary: 'ui-icon-triangle-1-w'});
  };

  /*********************************************************************
   *
   * ADJUST / ROTATE
   *
   ********************************************************************/
  function createRotateAttribute () {
    $(this).addMenuButton('Rotate').click(function () {
      console.log('Rotate 90 degrees');

      var temporaryCanvas = $('<canvas>')[0];

      // Set new width and height
      temporaryCanvas.width = $.getCanvasElement().height;
      temporaryCanvas.height = $.getCanvasElement().width;

      // Do some transition magic
      var context = temporaryCanvas.getContext('2d');
      context.save();
      context.translate($.getCanvasElement().height, 0);
      context.rotate(Math.PI / 2);
      context.drawImage($.getCanvasElement(), 0, 0, $.getCanvasElement().width, $.getCanvasElement().height);
      context.restore();

      // Update view
      $.updateCanvas(temporaryCanvas);
      $.setDirty();
    });
  }

  /*********************************************************************
   *
   * ADJUST / MIRROR
   *
   ********************************************************************/
  function createMirrorAttribute () {

    $(this).addMenuButton('Mirror').click(function () {
      var gl = nokia.gl;
      var glu = nokia.glu;
      glu.drawMirrored(gl.textureOriginal);
      glu.texImage2D(gl.textureOriginal, gl.canvas, true);
      $.setDirty();
    });
  }

  /*********************************************************************
   *
   * ADJUST / SCALE
   *
   ********************************************************************/
  function createScaleAttribute () {
    var scaleDimension = $('<div/>');
    scaleDimension.css('margin-bottom', '1em');

    /**
     * Updates shown image dimension
     *
     * @param scale {Number} 0..100
     */
    var updateScaleDimension = function (scale) {
      var newWidth = Math.round($.getCanvasElement().width * scale / 100, 2);
      var newHeight = Math.round($.getCanvasElement().height * scale / 100, 2);

      scaleDimension.text('Dimension: ' + newWidth + 'x' + newHeight + ' (' + scale + '%)');
    };

    var updateScaleAbsDimension = function (newWidth, newHeight) {
      var scale = Math.round(100 * newWidth / $.getCanvasElement().width, 2);
      scaleDimension.text('Dimension: ' + newWidth + 'x' + newHeight + ' (' + scale + '%)');
    };

    var scaleSlider = $('<div/>').slider({
      min: 10,
      max: 200,
      step: 0.01,
      value: 100,
      slide: function (evt, ui) {
        updateScaleDimension(ui.value);
      }
    });

    scaleSlider.css('margin-bottom', '1em');

    var scaleButtonGroup = $('<div/>');

    // Create quick scale buttons
    scaleButtonGroup.addPushButton('25%');
    scaleButtonGroup.addPushButton('50%');
    scaleButtonGroup.addPushButton('75%');
    scaleButtonGroup.addPushButton('100%');
    scaleButtonGroup.addPushButton('150%');
    scaleButtonGroup.addPushButton('200%');

    // Bind click event for quick scale buttons
    scaleButtonGroup.children().click(function () {
      var scaleValue = parseInt($(this).text().replace('%', ''), 10);
      scaleSlider.slider('value', scaleValue);
      updateScaleDimension(scaleValue);
    });

    scaleButtonGroup.buttonset();
    scaleButtonGroup.css('text-align', 'center');
    scaleButtonGroup.css('margin-bottom', '1em');

    // Create quick buttons to set the absolute pixel width

    var scaleAbsButtonGroup = $('<div/>');
    scaleAbsButtonGroup.addPushButton('640px');
    scaleAbsButtonGroup.addPushButton('960px');
    scaleAbsButtonGroup.addPushButton('1920px');

    // Bind click event for quick scale buttons
    scaleAbsButtonGroup.children().click(function () {
      var newWidth = parseInt($(this).text().replace('px', ''), 10);
      var newScale = Math.round(100 * newWidth / $.getCanvasElement().width);
      var newHeight = newScale * $.getCanvasElement().height / 100;
      scaleSlider.slider('value', newScale);
      updateScaleAbsDimension(newWidth, newHeight);
    });

    scaleAbsButtonGroup.buttonset();
    scaleAbsButtonGroup.css('text-align', 'center');
    scaleAbsButtonGroup.css('margin-bottom', '1em');

    var scaleContainer = $('<div/>')
        .append(scaleDimension)
        .append(scaleSlider)
        .append(scaleButtonGroup)
        .append(scaleAbsButtonGroup);

    var scaleCancel = scaleContainer.addPushButton('Cancel').click(function () {
      scaleAttribute.click();
    });

    var scaleApply = scaleContainer.addPushButton('Apply').click(function () {
      scaleAttribute.click();
      var scaleValue = scaleSlider.slider('value') / 100.0;

      var temporaryCanvas = $('<canvas>')[0];

      temporaryCanvas.width = $.getCanvasElement().width * scaleValue;
      temporaryCanvas.height = $.getCanvasElement().height * scaleValue;

      console.log("scaling to " + temporaryCanvas.width +  " x " + temporaryCanvas.height);

      var context = temporaryCanvas.getContext('2d');

      context.save();
      context.scale(scaleValue, scaleValue);
      context.drawImage($.getCanvasElement(), 0, 0, $.getCanvasElement().width, $.getCanvasElement().height);
      context.restore();

      $.updateCanvas(temporaryCanvas);
      $.setDirty();
    });

    scaleApply.css('float', 'right');

    var scaleAttribute = $(this).addCustomAttribute('Scale', scaleContainer);

    scaleAttribute.click(function () {
      if ($(this).buttonValue()) {
        $.getMenu().find('button').not(this).button('disable');
        scaleSlider.slider('value', 100);
        updateScaleDimension(100);
      } else {
        $.getMenu().find('button').not(this).button('enable');
      }
    });
  }

  /*********************************************************************
   *
   * ADJUST / CROP
   *
   ********************************************************************/
  function createCropAttribute () {

    var orgW = $.getCanvasElement().width;
    var orgH = $.getCanvasElement().height;

    // Create a backup of the current (un-cropped) canvas

    var currentCanvas = $.getCanvasElement();
    var backupCanvas = $('<canvas>')[0];
    var backupCtx = backupCanvas.getContext('2d');
    backupCanvas.width = currentCanvas.width;
    backupCanvas.height = currentCanvas.height;
    backupCtx.drawImage(currentCanvas, 0, 0, currentCanvas.width, currentCanvas.height);

    // Snap the aspect ratio of the image to one of the predefined ratios if it's close enough

    var cropOrgAspect = orgW/orgH;
    cropOrgAspect = nokia.utils.isAboutEqual(cropOrgAspect, 4/3, 2/orgW) ? 4/3 : cropOrgAspect;
    cropOrgAspect = nokia.utils.isAboutEqual(cropOrgAspect, 3/4, 2/orgH) ? 3/4 : cropOrgAspect;
    cropOrgAspect = nokia.utils.isAboutEqual(cropOrgAspect, 3/2, 2/orgW) ? 3/2 : cropOrgAspect;
    cropOrgAspect = nokia.utils.isAboutEqual(cropOrgAspect, 2/3, 2/orgH) ? 2/3 : cropOrgAspect;
    cropOrgAspect = nokia.utils.isAboutEqual(cropOrgAspect, 16/9, 2/orgW) ? 16/9 : cropOrgAspect;
    if (cropOrgAspect != orgW/orgH) {
      console.log("Original aspect ratio = " + orgW/orgH + " rounded to " + cropOrgAspect);
    }

    // TODO: move cropX & cropY from screen space to image space (to minimize rounding errors)

    var cropTargetAspect = cropOrgAspect;
    var cropAspectRatioLocked = true;
    var cropX = $.getCanvasObject().width() / 2;
    var cropY = $.getCanvasObject().height() / 2;
    var cropSliderXValue = 0.75;
    var cropSliderYValue = 0.75;

    var updateCropView = function () {
      
      // console.log('update crop', cropX, cropY, cropSliderValue);

      var newWidth = $.getCanvasObject().width() * cropSliderXValue;
      var newHeight = $.getCanvasObject().height() * cropSliderYValue;

      cropBorderRect.width(newWidth);
      cropBorderRect.height(newHeight);

      cropX = Math.max(cropX, Math.floor(cropBorderRect.width() / 2));
      cropY = Math.max(cropY, Math.floor(cropBorderRect.height() / 2));

      cropX = Math.min(cropX, $.getCanvasObject().width() - Math.floor(cropBorderRect.width() / 2));
      cropY = Math.min(cropY, $.getCanvasObject().height() - Math.floor(cropBorderRect.height() / 2));
      
      var canvasPosition = $.getCanvasObject().position();

      cropBorderRect.css({
        left: canvasPosition.left + cropX - (newWidth / 2),
        top: canvasPosition.top + cropY - (newHeight / 2)
      });
    };

    // Create a <div> to visualize the crop rectangle

    var cropBorderRect = $('<div/>').id('crop-border-rectangle');
    cropBorderRect.css({
      outline: 'dotted 3px white',
      'background-color': 'gray',
      opacity: 0.5,
      position: 'absolute'
    });

    // Create and populate the crop dialog

    var cropContainer = $('<div/>').id('crop-container').css('text-align', 'center');
    var cropRatioButtons = $('<div/>').id('crop-ratio-buttons').css('margin-bottom', '1em');
    var cropSliderX = $('<div/>').id('crop-slider-x').css('margin', '1em').show();
    var cropSliderY = $('<div/>').id('crop-slider-y').css('margin', '1em').hide();
    var cropCancelButton = $('<button/>').text('Cancel').id('crop-cancel-button').css('float', 'left').button();
    var cropPreviewButton = $('<button/>').text('Preview (press & hold)').id('crop-preview-button').button();
    var cropApplyButton = $('<button/>').text('Apply').id('crop-apply-button').css('float', 'right').button();

    cropContainer.append(cropRatioButtons);
    cropContainer.append(cropSliderX);
    cropContainer.append(cropSliderY);
    cropContainer.append(cropCancelButton);
    cropContainer.append(cropPreviewButton);
    cropContainer.append(cropApplyButton);

    // Create a button group for aspect ratio control

    cropRatioButtons.addPushButton("4:3");
    cropRatioButtons.addPushButton("3:2");
    cropRatioButtons.addPushButton("16:9");
    cropRatioButtons.addPushButton("Free");
    cropRatioButtons.addPushButton("3:4");
    cropRatioButtons.addPushButton("2:3");
    cropRatioButtons.addPushButton("Reset");
    cropRatioButtons.buttonset();

    cropRatioButtons.children().click(function () {
      var resetCrop = false;
      cropAspectRatioLocked = true;
      cropSliderY.hide();

      switch ($(this).text()) {
      case "4:3":
        cropTargetAspect = 4/3; 
        break;
      case "3:4":
        cropTargetAspect = 3/4;
        break;
      case "3:2":
        cropTargetAspect = 3/2;
        break;
      case "2:3":
        cropTargetAspect = 2/3;
        break;
      case "16:9":
        cropTargetAspect = 16/9;
        break;
      case "Reset":
        resetCrop = true;
        cropTargetAspect = cropOrgAspect;
        break;
      case "Free":
        cropTargetAspect = cropOrgAspect;
        cropAspectRatioLocked = false;
        cropSliderY.show();
        break;
      default:
        console.log("Button '" + $(this).text() + "' not implemented!");
        break;
      }

      console.log("original & target aspect ratios: " + cropOrgAspect + ", " + cropTargetAspect);

      var makeThinner = (cropOrgAspect > cropTargetAspect);
      var makeWider = (cropOrgAspect < cropTargetAspect);
      if (makeThinner) {
        cropSliderXValue = cropTargetAspect / cropOrgAspect;
        cropSliderYValue = 1.0;
      } else if (makeWider) {
        cropSliderXValue = 1.0;
        cropSliderYValue = cropOrgAspect / cropTargetAspect;
      } else if (resetCrop === true) {
        cropSliderXValue = 1.0;
        cropSliderYValue = 1.0;
      } else {
        cropSliderYValue = cropSliderXValue;
      }

      cropSliderX.slider('value', cropSliderXValue);
      cropSliderY.slider('value', cropSliderYValue);
      updateCropView();
    });

    // Set up sliders for X & Y crop rectangle size

    cropSliderX.slider({
      min: 0,
      max: 1,
      step: 1/$.getCanvasElement().width,
      value: cropSliderXValue,
      slide: function (evt, ui) {
        if (cropAspectRatioLocked) {
        if (cropOrgAspect == cropTargetAspect) {
          cropSliderXValue = ui.value;
          cropSliderYValue = ui.value;
        } else {
          var sliderRatioYperX = cropOrgAspect / cropTargetAspect;
          var sliderRatioXperY = cropTargetAspect / cropOrgAspect;
          cropSliderXValue = Math.min(sliderRatioXperY, ui.value);
          cropSliderYValue = Math.min(1.0, ui.value * sliderRatioYperX);
        }
        } else {
        cropSliderXValue = ui.value;
        }
        //console.log('crop slider x,y = ' + cropSliderXValue + ", " + cropSliderYValue);
        updateCropView();
      }
    });

    cropSliderY.slider({
      min: 0,
      max: 1,
      step: 1/$.getCanvasElement().height,
      value: cropSliderYValue,
      slide: function (evt, ui) {
        cropSliderYValue = ui.value;
        updateCropView();
      }
    });

    // Preview button handler

    cropPreviewButton.mousedown(function () {

      cropBorderRect.hide();
      cropContainer.addClass('invisible');
      //cropContainer.css(fadeTo(1000, 0.01);

      // Compute a scaling factor to convert screen pixels to image
      // pixels

      var ratio = orgW / $.getCanvasObject().width();

      // Compute the top left corner position of the crop window

      var cropWidth = cropSliderXValue * orgW;
      var cropHeight = cropSliderYValue * orgH;
      var startX = cropX * ratio - cropWidth / 2;
      var startY = cropY * ratio - cropHeight / 2;
      console.log('crop ' + cropWidth + " x " + cropHeight + " pixels at " + startX + ", " + startY);

      // Create a temporary canvas to serve as the crop destination

      var tempCanvas = $('<canvas>')[0];
      tempCanvas.width = cropWidth;
      tempCanvas.height = cropHeight;

      // Draw the cropped image to tempCanvas and from there to screen

      var canvasContext = tempCanvas.getContext('2d');
      canvasContext.save();
      canvasContext.translate(-startX, -startY);
      canvasContext.drawImage($.getCanvasElement(), 0, 0, $.getCanvasElement().width, $.getCanvasElement().height);
      canvasContext.restore();
      $.updateCanvas(tempCanvas);
    });

    // Restore the original, un-cropped image when done previewing

    cropPreviewButton.mouseup(function() {
      if (cropBorderRect.css('display') == 'none') {
        $.updateCanvas(backupCanvas);
        cropBorderRect.show();
        cropContainer.removeClass('invisible');
      }
    });

    cropPreviewButton.mouseleave(function() {
      if (cropBorderRect.css('display') == 'none') {
        $.updateCanvas(backupCanvas);
        cropBorderRect.show();
        cropContainer.removeClass('invisible');
      }
    });

    // Set up Cancel and Apply buttons

    cropCancelButton.click(function () {
      cropAttribute.click();    // just hide the Crop dialog
    });

    cropApplyButton.click(function () {

      // Hide the crop dialog

      cropAttribute.click();

      // Compute a scaling factor to convert screen pixels to image
      // pixels

      var ratio = orgW / $.getCanvasObject().width();

      // Compute the top left corner position of the crop window

      var cropWidth = cropSliderXValue * orgW;
      var cropHeight = cropSliderYValue * orgH;
      var startX = cropX * ratio - cropWidth / 2;
      var startY = cropY * ratio - cropHeight / 2;
      console.log('crop ' + cropWidth + " x " + cropHeight + " pixels at " + startX + ", " + startY);

      // Create a temporary canvas to serve as the crop destination

      var tempCanvas = $('<canvas>')[0];
      tempCanvas.width = cropWidth;
      tempCanvas.height = cropHeight;

      // Do some transformation magic

      var canvasContext = tempCanvas.getContext('2d');
      canvasContext.save();
      canvasContext.translate(-startX, -startY);
      canvasContext.drawImage($.getCanvasElement(), 0, 0, $.getCanvasElement().width, $.getCanvasElement().height);
      canvasContext.restore();

      // Update the view

      $.updateCanvas(tempCanvas);
      $.setDirty();
    });

    cropContainer.mouseenter(function () {
      //cropSliderX.show();
      //if (cropAspectRatioLocked == false) {
      //  cropSliderY.show();
      //}
    });

    cropContainer.mouseleave(function () {
      //cropSliderX.hide();
      //cropSliderY.hide();
    });

    var cropAttribute = $(this).addCustomAttribute('Crop', cropContainer);

    // Create div for mouse clicks

    var cropClickView = $('<div/>');
    var mouseDown = false;

    cropClickView.mousedown(function (evt) {
      mouseDown = true;
      cropX = evt.layerX;
      cropY = evt.layerY;
      updateCropView();
      return false;
    });
    cropClickView.mouseup(function (evt) {
      mouseDown = false;
      cropX = evt.layerX;
      cropY = evt.layerY;
      updateCropView();
    });
    cropClickView.mousemove(function (evt) {
      if (!mouseDown) {
        return;
      }
      cropX = evt.layerX;
      cropY = evt.layerY;
      updateCropView();
    });

    // Use same size as canvas uses

    $.getContainer().append(cropBorderRect, cropClickView);

    // Initially hide crop views
    cropBorderRect.hide();
    cropClickView.hide();

    cropAttribute.click(function () {
      if ($(this).buttonValue()) {

        // Disable other buttons
        $.getMenu().find('button').not(this).button('disable');

        cropClickView.width($.getCanvasObject().width());
        cropClickView.height($.getCanvasObject().height());

        cropClickView.css({
          position: 'absolute',
          top: $.getCanvasObject().css('top'),
          left: $.getCanvasObject().css('left')
        });
        
        cropBorderRect.show();
        cropClickView.show();
        updateCropView();
      } else {

        // Enable other buttons
        $.getMenu().find('button').not(this).button('enable');

        // Hide views
        cropClickView.hide();
        cropBorderRect.hide();
      }
    });
  }

  /*********************************************************************
   *
   * COMMON UTILITY FUNCTIONS
   *
   ********************************************************************/
  jQuery.fn.clearMenu = function () {
    $('*', this).remove();
  };

  jQuery.saveImage = function (sourceCanvas) {

    var storageName = $.getContainer().data('image-name');
    if (storageName === null) {
      var rnd = Math.floor(Math.random()*1000000000);
      storageName = 'img' + rnd;
    }

    // Generate a thumbnail image using a temp canvas

    var thumbnailCanvas = $('<canvas>')[0];
    var thumbnailContext = thumbnailCanvas.getContext('2d');
    var scale = Math.max(150 / sourceCanvas.width, 150 / sourceCanvas.height);
    thumbnailCanvas.width = sourceCanvas.width * scale;
    thumbnailCanvas.height = sourceCanvas.height * scale;
    thumbnailContext.drawImage(sourceCanvas, 0, 0, thumbnailCanvas.width, thumbnailCanvas.height);

    // Store the full-size image and the thumbnail in
    // JPEG format, base64-encoded into the DataURL
    // format. We should really use a lossless format
    // (PNG) or a very high quality setting for JPEG
    // to avoid cumulative compression artifacts, but
    // unfortunately today's browsers have a limited
    // amount of megabytes allocated for localStorage.

    var imageData = sourceCanvas.toDataURL('image/png');
    var thumbnailImageData = thumbnailCanvas.toDataURL('image/jpeg');
    console.log('Saving', storageName, 
                (imageData.length/1024).toFixed(0), 'kB; thumbnail', 
                (thumbnailImageData.length/1024).toFixed(0), 'kB');
    nokia.Storage.saveImage(storageName, imageData, thumbnailImageData);
    console.log('Image and thumbnail saved');
  };

  /**
   * Sets the CSS width and height of the canvas according to the
   * following rules: 1) Keep the entire image visible; 2) Retain
   * the original aspect ratio of the image; 3) Maximize the screen
   * size of the image.
   */
  jQuery.resizeCanvasCSS = function() {

    var imageCanvas = $.getCanvasElement();  // the HTML DOM canvas element
    var imageWidth = imageCanvas.width;      // the real image dimensions
    var imageHeight = imageCanvas.height;

    // Set the CSS width and height of the canvas to maximize its size
    // while using the same scale factor for both X and Y to retain
    // the original aspect ratio. Note that images smaller than the
    // screen will be scaled up.

    var viewportWidth = $(window).width() - 222;  // menu (210px) + margin (12 px)
    var viewportHeight = $(window).height() - 12; // margin at top & bottom (12 px)
    var scaleX = viewportWidth / imageWidth;
    var scaleY = viewportHeight / imageHeight;
    var scale = Math.min(scaleX, scaleY);
    var cssWidth = Math.floor(imageWidth * scale);
    var cssHeight = Math.floor(imageHeight * scale);
    $.getCanvasObject().width(cssWidth);
    $.getCanvasObject().height(cssHeight);

    // Force the canvas container element to be large enough to
    // enclose the canvas element, including its drop shadows.

    $.getContainer().width($(window).width());
    $.getContainer().height($(window).height());

    console.log("resizeCanvasCSS:");
    console.log("  image width/height = ", imageWidth, imageHeight);
    console.log("  viewport width/height = ", viewportWidth, viewportHeight);
    console.log("  CSS width/height = ", cssWidth, cssHeight);
  };

  /** @private */
  jQuery.imageOnload = function () {
    $.updateCanvas(this);
    $.getCanvasObject().show();
  };

  /**
   * Loads an image from the given URL. Reuses a single global <img>
   * element to reduce GC burden.
   *
   * @param {String} imageURL the URL of the image
   */
  jQuery.loadImageFromURL = function (imageURL) {
    jQuery.img.onload = $.imageOnload;
    jQuery.img.src = imageURL;
  };

  /**
   * Load image from local storage to editor.
   *
   * @param {String} name
   */
  jQuery.loadImageFromStorage = function (name) {
    nokia.Storage.loadImage(name, $.imageOnload);
  };

  /**
   * Helper function to get editors menu container
   *
   * @returns {jQuery}
   */
  jQuery.getMenu = function () {
    return $('#menu');
  };

  /**
   * Helper function to get editors image container
   *
   * @returns {jQuery}
   */
  jQuery.getContainer = function () {
    return $('#container');
  };

  /**
   * Helper function to get editors attribute container
   *
   * @returns {jQuery}
   */
  jQuery.getAttributes = function () {
    return $('#attributeContainer');
  };
        
  /**
   * Retrieves the '#canvas3d' jQuery object.
   *
   * @return {Object} the jQuery object corresponding to the '#canvas3d' HTML Canvas element
   */
  jQuery.getCanvasObject = function () {
    return $('#canvas3d');
  };

  /**
   * Retrieves the '#canvas3d' HTML Canvas element.
   *
   * @return {HTMLCanvasElement} the Canvas element that has the id '#canvas3d'
   */
  jQuery.getCanvasElement = function () {
    return $('#canvas3d')[0];
  };

  /**
   * Renders the given HTML image or canvas to the 3D canvas,
   * initializing and/or resizing the 3D canvas if necessary.
   * The new image is also stored into a GL texture that is used
   * as the primary image data source elsewhere in the editor.
   *
   * @param {HTMLImageElement/HTMLCanvasElement} newImage the new
   *        image or canvas
   */
  jQuery.updateCanvas = function (newImage) {
    console.log("updateCanvas(" + newImage + "): ");
    console.log("  old canvas size = " + $.getCanvasElement().width + " x " + $.getCanvasElement().height);
    console.log("  new canvas size = " + newImage.width + " x " + newImage.height);

    var width = newImage.width;
    var height = newImage.height;

    // Need to recreate all GL objects from scratch if the canvas is resized

    if (!$.gl || $.getCanvasElement().width != width || $.getCanvasElement().height != height) {
 
      $.getCanvasElement().width = width;
      $.getCanvasElement().height = height;

      if (!$.gl) { 
        console.log("  creating a GL context and the necessary GL objects"); 
        $.gl = nokia.glu.createGL($.getCanvasElement(), newImage);
      } else { 
        console.log("  using an existing GL context"); 
        $.gl = nokia.glu.reuseGL($.getCanvasElement(), newImage);
      }

      if ($.gl != null) {
        var gl = nokia.gl;
        var glu = nokia.glu;
        glu.drawDefault(gl.textureOriginal);
      } else {
        window.location = 'http://get.webgl.org';
      }

    } else {
      var gl = nokia.gl;
      var glu = nokia.glu;
      glu.texImage2D(gl.textureOriginal, newImage, true);
      glu.drawDefault(gl.textureOriginal);
    }

    $.resizeCanvasCSS();
  };

  /** @private */
  var dirtyFlag = false;

  /**
   * Sets dirty flag
   */
  jQuery.setDirty = function () {
    dirtyFlag = true;
  };

  /**
   * Clears dirty flag
   */
  jQuery.clearDirty = function () {
    dirtyFlag = false;
  };

  /**
   * Check if dirty flag is on
   *
   * @return {Boolean} True if it is dirty.
   */
  jQuery.isDirty = function () {
    return dirtyFlag;
  };

  /*********************************************************************
   *
   * WINDOW RESIZE EVENT
   *
   ********************************************************************/
  $(window).bind('resize', function(event) {
    if ($.getCanvasElement() != null) {
      $.resizeCanvasCSS();
    }
  });

})(jQuery, nokia);
