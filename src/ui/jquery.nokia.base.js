//
//  jquery.nokia.base
//
//  Created by Timo Reunanen on 2010-05-06.
//  Copyright (c) 2010 Nokia Oy. All rights reserved.
//

(function ($) {

  /**
   * @name jQuery
   * @namespace
   *
   * Additional global jQuery functions.
   *
   */

  /**
   * @name jQuery.fn
   * @namespace
   *
   * Additional jQuery functions.
   *
   */

  /**
   * Helper function with handling elements id
   *
   * @example
   * $('#foo').id('bar');
   *
   * @param id Value for id. If defined function returns self, if not function returns value.
   *
   * @return {jQuery} If id defined, returns self, if not returns value.
   */

  jQuery.fn.id = function (id) {
    if (id !== undefined) {
      return this.attr("id", id);
    }

    return this.attr('id');
  };

  /**
   * Adds a push button to self.
   *
   * @example
   * $('#menu').addPushButton('My Button').click(function () { console.log('click'); });
   *
   * @param label a free-text label for the button
   *
   * @returns {jQuery} the newly created button
   */

  jQuery.fn.addPushButton = function (label) {
    var newButton = $('<button/>');
    newButton.text(label);
    newButton.button();
    newButton.appendTo(this);
    return newButton;
  };

  /**
   * Adds a push button of class 'menu-button' to self.
   *
   * @param label a free-text label for the button
   *
   * @return {jQuery} the newly created button
   */

  jQuery.fn.addMenuButton = function(label) {

    var mouseLeaveHandler = function() {
      $(this).removeClass('ui-state-focus');
    };

    var newButton = this.addPushButton(label);
    newButton.addClass('menu-button');
    newButton.bind('mouseleave.button', mouseLeaveHandler);
    return newButton;
  };

  /**
   * Creates an anchor (<a>) that looks like a regular
   * menu button and adds it to self.
   *
   * @param label a free-text label for the "button"
   *
   * @return {jQuery} the newly created "button"
   */

  jQuery.fn.addHrefButton = function(label, data, name) {

    var mouseLeaveHandler = function() {
      $(this).removeClass('ui-state-focus');
    };

    var newButton = $('<a>');
    newButton.text(label);
    newButton.button();
    newButton.addClass('menu-button');
    newButton.bind('mouseleave.button', mouseLeaveHandler);
    newButton.appendTo(this);
    return newButton;
  };

  /**
   * Adds a toggle button to self.
   *
   * @example
   * $('#menu').addToggleButton('My Toggle').click(function () {
   *   if ($(this).buttonValue()) {
   *     console.log('Button toggled');
   *   } else {
   *     console.log('Button untoggled');
   *   }
   * });
   *
   * @param label a free-text label for the butotn
   *
   * @return {jQuery} the newly created button
   */

  jQuery.fn.addToggleButton = function(label) {

    var clickHandler = function() {
      if ($(this).data('button-value')) {
        $(this).data('button-value', false);
        $(this).removeClass('ui-state-active');
      } else {
        $(this).data('button-value', true);
        $(this).addClass('ui-state-active');
      }
    };

    var mouseLeaveHandler = function() {
      if ($(this).data('button-value')) {
        $(this).addClass('ui-state-active');
      } else {
        $(this).removeClass('ui-state-active');
      }
      $(this).removeClass('ui-state-focus');
    };

    var newToggle = this.addPushButton(label);
    newToggle.click(clickHandler);
    newToggle.bind('mouseleave.button', mouseLeaveHandler);
    newToggle.attr('role', 'toggle-button');
    return newToggle;
  };


  /**
   * Adds a toggle button of class 'menu-button' to self.
   *
   * @see jQuery.fn.addToggleButton
   *
   * @param label a free-text label for the button
   *
   * @return {jQuery} the newly created button
   */

  jQuery.fn.addToggleMenuButton = function(label) {
    var newToggle = this.addToggleButton(label);
    newToggle.addClass('menu-button');
    return newToggle;
  };

  /**
   * Get or set toggleabled buttons value.
   *
   * @example
   * if $('#toggleButton').buttonValue()) {
   *   console.log('toggled');
   * }
   *
   * @param val Value to set.
   *
   * @return {jQuery} If value is defined returns self, if not returns saved value.
   */

  jQuery.fn.buttonValue = function(val) {
    if (val === undefined) {
      return !!this.data('button-value');
    }

    if (this.attr('role') != 'toggle-button') {
      return this;
    }

    this.data('button-value', val);
    if (val) {
      this.addClass('ui-state-active');
    } else {
      this.removeClass('ui-state-active');
    }
    return this;
  };

  /**
   * Makes button group.
   *
   * @example
   * var buttonSet = $('&lt;div/&gt').appendTo('body');
   * buttonSet.addToggleButton('Foo');
   * buttonSet.addToggleButton('Bar');
   * buttonSet.addToggleButton('Baz');
   * buttonSet.groupButtons();
   */
  jQuery.fn.groupButtons = function() {
    var self = this;

    $('[role=toggle-button]', this).click(function () {
      var btnSelf = this;

      if ($(this).buttonValue()) {
        $('*', self).each(function () {
          if (this == btnSelf) {
            return;
          }

          if ($(this).buttonValue())
          {
            $(this).click();
          }
        });
      }
    });
  };

  /**
   * Add slider.
   *
   * @example
   * $('content').addSlider();
   *
   * @param sliderOptions
   *
   * @return {jQuery}
   */
  jQuery.fn.addSlider = function (sliderOptions) {
    return $('<div />')
      .slider(sliderOptions)
      .appendTo(this);
  };

  /**
   * Creates attribute with slider.
   *
   * @param label a free-text label for the slider toggle button
   * @param sliderOptions Options for slider.
   *
   * @return button
   */

  jQuery.fn.addSliderAttribute = function (label, sliderOptions) {

    var sliderContainer = $('<div/>');

    if (sliderOptions.range === undefined) {
      sliderOptions.range = 'min';
    }

    var slider = $('<div/>').slider(sliderOptions);
    slider.appendTo(sliderContainer);

    var newButton = this.addCustomAttribute(label, sliderContainer);
    newButton.data('slider', slider);

    return newButton;
  };

  /**
   * Create custom attribute.
   *
   * @param label Label/name.
   * @param attributeContainer Element container used with this attribute. Optional.
   *
   * @return button
   */

  jQuery.fn.addCustomAttribute = function (label, attributeContainer) {
    var self = this;

    var newButton = this.addToggleMenuButton(label);
    newButton.addClass('attribute-slider-button');
    newButton.appendTo(this);

    var clickHandler = function() {
      // 'this' = the clicked button.
      if ($(this).buttonValue()) {  

        // button toggled on ==> show slider

        if ($(this).data('attributeContainer')) {
          $(this).data('attributeContainer').show();
        }

        // Hide other attribute containers and untoggle buttons.
        var buttonSelf = this;

        $('.attribute-slider-button', self).each(function() {
          // this = current element in selection

          if (this == buttonSelf) {
            return;
          }

          $(this).buttonValue(false);

          if ($(this).data('attributeContainer')) {
            $(this).data('attributeContainer').hide();
          }
        });

      } else {
        // button toggled off ==> hide the slider
        if ($(this).data('attributeContainer')) {
          $(this).data('attributeContainer').hide();
        }
      }
    };

    newButton.click(clickHandler);

    if (attributeContainer !== undefined) {
      newButton.data('attributeContainer', attributeContainer);
      attributeContainer.addClass("ui-widget ui-state-default ui-widget-content ui-corner-all");
      attributeContainer.appendTo($.getAttributes());
      attributeContainer.css({ padding: 15 });
      attributeContainer.hide();
    }

    return newButton;
  };

  /**
   * Hides attribute view.
   *
   * @example btn.hideAttributeView();
   */
  jQuery.fn.hideAttributeView = function () {
    $(this).buttonValue(false);

    if ($(this).data('attributeContainer')) {
      $(this).data('attributeContainer').hide();
    }
  };

  /**
   * Check if selected element is landscape or not.
   *
   * @return boolean. True if it's landscape.
   */

  jQuery.fn.isLandscape = function  () {
    return $(this).width() > $(this).height();
  };

  // Save original click binder.
  var __origClick = jQuery.fn.click;

  /** @private
   * Try-catch for all click events.
   */
  jQuery.fn.click = function (fn) {
    if (!fn) {
      return __origClick.call(this);
    }


    return __origClick.call(this, function () {
      try {
        fn.apply(this, arguments);
      } catch(err) {
        alert("An error occured!\n\n " + err);
        throw err;
      }
    });
  };

})(jQuery);
