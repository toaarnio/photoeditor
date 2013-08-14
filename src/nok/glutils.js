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
 * WebGL rendering framework and utilities for 2D image processing.
 *
 * @author Tomi Aarnio, Nokia Research Tampere, 2011
 */

goog.require('nokia.utils');

goog.provide('nokia.gl');

///////////////////////////////////////////////////////////////////////////////////////
//
// Private Implementation
//
///////////////////////////////////////////////////////////////////////////////////////

(function () {

  /**
   * Before going any further, check that the browser actually
   * supports WebGL.
   */

  if (!window.WebGLRenderingContext) {
    alert("This page requires a browser with WebGL support.");
    window.location = "http://get.webgl.org";
  }

  /**
   * @namespace
   */
  nokia.gl = {};

  ///////////////////////////////////////////////////////////////////////////////////////
  //
  // Public variables.
  //
  ///////////////////////////////////////////////////////////////////////////////////////

  /**
   * The current GL context.
   */
  nokia.gl.context = null;

  /**
   * Built-in fragment shaders in compiled and linked form, indexed by
   * file name, for example, nokia.gl.shaders["zoomblend"]. These are
   * guaranteed to be valid for the current GL context.
   */
  nokia.gl.shaders = [];

  /**
   * The Canvas element that the current GL context is associated with.
   */
  nokia.gl.canvas = null;

  /**
   * The width and height of the Canvas associated with the current GL
   * context, in pixels.  Note that these are the real dimensions of
   * the canvas, not the CSS or screen dimensions.
   */
  nokia.gl.width = 0;
  nokia.gl.height = 0;

  ///////////////////////////////////////////////////////////////////////////////////////
  //
  // Private variables. DO NOT USE FROM OUTSIDE THIS FILE.
  //
  ///////////////////////////////////////////////////////////////////////////////////////

  /**
   * Default vertex shader file name.
   *
   * @private
   */
  nokia.gl.vsName = "default-vertexshader";

  /**
   * Default vertex shader source code.
   *
   * @private
   */
  nokia.gl.vsSource = null;

  /**
   * Default vertex shader compiled binary.
   *
   * @private
   */
  nokia.gl.vsBinary = null;

  /**
   * Built-in fragment shader file names.
   *
   * @private
   */
  nokia.gl.fsNames = [ "default",
                       //"debug",
                       "mirrorX",
                       "mirrorY",
                       "brush",
                       "zoomblend",
                       "zoom" ];

  /**
   * Built-in fragment shaders in source code form, indexed by file name.
   *
   * @private
   */
  nokia.gl.fsSources = [];

  ///////////////////////////////////////////////////////////////////////////////////////
  //
  // WebGL utils that are typically used during setup stage
  //
  ///////////////////////////////////////////////////////////////////////////////////////

  nokia.gl.loadShaderSource = function (shaderName) {
    var URI = "shaders/" + shaderName + ".gl";
    var src = nokia.utils.loadKernel(shaderName, URI);
    return src;
  };

  // Load the default vertex shader and all fragment shaders, except
  // for the effect-specific ones.  Unfortunately we can't compile any
  // shaders yet, because a WebGL context will only become available
  // later.

  nokia.gl.vsSource = nokia.gl.loadShaderSource(nokia.gl.vsName);

  for (var idx in nokia.gl.fsNames) {
    var name = nokia.gl.fsNames[idx];
    var src = nokia.gl.loadShaderSource(name);
    nokia.gl.fsSources[name] = src;
  }

  /**
   * Private implementation.
   */
  nokia.gl.setupGL = function (canvas, image) {

    console.log("<setupGL start>");

    // Clear leftover shader objects from any previous GL context

    nokia.gl.shaders = [];
    nokia.gl.vsBinary = null;

    // Take a local copy of canvas attributes and create the WebGL context

    nokia.gl.canvas = canvas;
    nokia.gl.width = canvas.width;
    nokia.gl.height = canvas.height;
    nokia.gl.canvas.name = "GLCanvas";
    nokia.gl.context = nokia.gl.getContext(canvas);
    if (nokia.gl.context == null) {
      console.log("<setupGL terminated>");
      return null;
    }

    //nokia.gl.context = WebGLDebugUtils.makeDebugContext(nokia.gl.context);

    // Set up default geometry and other GL state

    var gl = nokia.gl.context;
    nokia.gl.setupDefaultGeometry(gl);
    gl.viewport(0, 0, nokia.gl.width, nokia.gl.height);

    // Compile the default vertex shader that is used with all fragment shaders

    nokia.gl.vsBinary = nokia.gl.createShader(gl, gl.VERTEX_SHADER, nokia.gl.vsSource);

    // Compile and link the shaders that are needed for painting, zooming, etc.

    for (var i in nokia.gl.fsNames) {
      var name = nokia.gl.fsNames[i];
      nokia.gl.setupShaderProgram(gl, name);
    }

    // Create default textures that are needed in all/most Effects

    nokia.gl.textureOriginal = nokia.gl.createTexture(gl, image.width, image.height, gl.RGBA, "original");
    nokia.gl.textureFiltered = nokia.gl.createTexture(gl, image.width, image.height, gl.RGBA, "filtered");
    nokia.gl.texturePainted = nokia.gl.createTexture(gl, image.width, image.height, gl.RGBA, "painted");
    nokia.gl.textureBrushMask = nokia.gl.createTexture(gl, image.width, image.height, gl.RGBA, "mask");
    nokia.gl.texImage2D(gl, nokia.gl.textureOriginal, image, true);
    nokia.gl.clearTexture(gl, nokia.gl.textureBrushMask);

    // Create a Frame Buffer Object (FBO) for rendering into the "mask" texture

    nokia.gl.textureBrushMaskFBO = nokia.gl.setupRenderToTexture(gl, nokia.gl.textureBrushMask);

    console.log("<setupGL success>");

    return nokia.gl.context;
  };

  /**
   * Reuses an existing GL context, recreating only what's necessary.
   */
  nokia.gl.reuseGL = function (canvas, image) {

    console.log("<reuseGL start>");

    // Take a local copy of canvas attributes

    nokia.gl.canvas = canvas;
    nokia.gl.width = canvas.width;
    nokia.gl.height = canvas.height;
    nokia.gl.canvas.name = "GLCanvas";
    
    // Set up default geometry and other GL state

    var gl = nokia.gl.context;
    nokia.gl.setupDefaultGeometry(gl);
    gl.viewport(0, 0, nokia.gl.width, nokia.gl.height);

    // Create default textures that are needed in all/most Effects

    nokia.gl.textureOriginal = nokia.gl.createTexture(gl, image.width, image.height, gl.RGBA, "original");
    nokia.gl.textureFiltered = nokia.gl.createTexture(gl, image.width, image.height, gl.RGBA, "filtered");
    nokia.gl.texturePainted = nokia.gl.createTexture(gl, image.width, image.height, gl.RGBA, "painted");
    nokia.gl.textureBrushMask = nokia.gl.createTexture(gl, image.width, image.height, gl.RGBA, "mask");
    nokia.gl.texImage2D(gl, nokia.gl.textureOriginal, image, true);
    nokia.gl.clearTexture(gl, nokia.gl.textureBrushMask);

    // Create a Frame Buffer Object (FBO) for rendering into the "mask" texture

    nokia.gl.textureBrushMaskFBO = nokia.gl.setupRenderToTexture(gl, nokia.gl.textureBrushMask);

    console.log("<reuseGL success>");

    return nokia.gl.context;
  };

  /**
   * Creates a WebGL context for the given canvas, or retrieves the
   * existing context if one has already been created. If the canvas
   * already has a 2D context, or WebGL is not supported, this
   * function will fail.
   *
   * @param {HTMLCanvasElement} canvas the canvas to get a WebGL
   * context from
   *
   * @return {WebGLRenderingContext} the WebGL context, or 'null' in
   * case of failure
   *
   * @private
   */
  nokia.gl.getContext = function (canvas) {
    var gl = null;
    var preferredAttribs = { alpha:true, 
                             depth:false, 
                             stencil:false, 
                             antialias:false, 
                             preserveDrawingBuffer:true,
                             premultipliedAlpha:true };

    try { 
      gl = canvas.getContext("experimental-webgl", preferredAttribs); 
      nokia.gl.printContextAttributes(gl);
    } catch (e) {}
    return gl;
  };

  nokia.gl.getShader = function(gl, shader, vertexShaderName, fragmentShaderName) {
    if (true) {
      console.log("nokia.gl.getShader: retrieving shader...");
      return nokia.gl.setupShaders(gl, vertexShaderName, fragmentShaderName);
    } else {
      console.log("nokia.gl.getShader: shader", shader.name, "already loaded.");
      return shader;
    }
  };

  nokia.gl.createShader = function (gl, type, source) {

    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    var infoLog = gl.getShaderInfoLog(shader);
    var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    console.log("  Shader compiler info log: " + (infoLog ? infoLog : "<empty>"));

    return success ? shader : null;
  };

  nokia.gl.createShaderProgram = function (gl, vsBinary, fsBinary) {
    
    var program = gl.createProgram();
    gl.attachShader(program, vsBinary);
    gl.attachShader(program, fsBinary);
    gl.linkProgram(program);

    var infoLog = gl.getProgramInfoLog(program);
    var success = gl.getProgramParameter(program, gl.LINK_STATUS);
    console.log("  Shader linker info log: " + (infoLog ? infoLog : "<empty>"));
    
    return success ? program : null;
  };

  /**
   * @private
   */
  nokia.gl.setupShaderProgram = function (gl, name) {

    console.log("Creating/retrieving shader '" + name + "'");

    nokia.gl.fsSources[name] = nokia.gl.fsSources[name] || nokia.gl.loadShaderSource(name);

    if (!nokia.gl.shaders[name]) {
      var vsSource = nokia.gl.vsSource;
      var fsSource = nokia.gl.fsSources[name];
      var fsBinary = nokia.gl.createShader(gl, gl.FRAGMENT_SHADER, fsSource);
      var program = nokia.gl.createShaderProgram(gl, nokia.gl.vsBinary, fsBinary);
      nokia.gl.shaders[name] = program;
      program.name = name;
    }

    return nokia.gl.shaders[name];
  };

  /**
   * Loads, compiles, links, and activates the given vertex shader
   * and fragment shader. The shaders are loaded either from the DOM
   * tree with the elements identified by the given shader names, or
   * failing that, from URIs formed by "./shaders/&lt;shaderName&gt;.gl".
   *
   * @param {WebGLRenderingContext} gl the WebGL context to associate
   * the shaders with
   *
   * @param {String} vertexShaderName the vertex shader to load
   * 
   * @param {String} fragmentShaderName the fragment shader to load;
   * this name is also associated with the shader program as a whole,
   * for logging and debugging purposes
   *
   * @return {WebGLProgram} The compiled and linked shader program,
   * or 'null' in case of failure
   *
   * @example 
   * var myShader = setupShaders($.gl, "default-vertexshader", "filter-bilateral");
   *
   */
  nokia.gl.setupShaders = function (gl, vertexShaderName, fragmentShaderName) {

    var vsURI = "shaders/" + vertexShaderName + ".gl";
    var fsURI = "shaders/" + fragmentShaderName + ".gl";
  
    var vertexShader = nokia.gl.setupShader(gl, gl.VERTEX_SHADER, vertexShaderName, vsURI);
    var fragmentShader = nokia.gl.setupShader(gl, gl.FRAGMENT_SHADER, fragmentShaderName, fsURI);

    if (!vertexShader || !fragmentShader) {
      return null;
    }

    var program = gl.createProgram();
    program.name = fragmentShaderName;

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    var infoLog = gl.getProgramInfoLog(program);
    var success = gl.getProgramParameter(program, gl.LINK_STATUS);
    
    console.log("Shader linker info log: " + (infoLog ? infoLog : "<empty>"));
    
    return success ? program : null;
  };

  nokia.gl.setupShaderProgramAsync = function (gl, vertexShaderName, fragmentShaderName) {

    var vsURI = "shaders/" + vertexShaderName + ".gl";
    var fsURI = "shaders/" + fragmentShaderName + ".gl";

    if (!nokia.gl.shaders[vertexShaderName]) {
      nokia.gl.shaders[vertexShaderName] = nokia.gl.setupShader(gl, gl.VERTEX_SHADER, vertexShaderName, vsURI);
    }

    var callback = function (fragmentShaderSource) {

      var shader = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(shader, fragmentShaderSource);
      gl.compileShader(shader);

      var infoLog = gl.getShaderInfoLog(shader);
      var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
      console.log("Shader compiler info log: " + (infoLog ? infoLog : "<empty>"));

      var program = gl.createProgram();
      program.name = fragmentShaderName;
      gl.attachShader(program, nokia.gl.shaders["default-vertexshader"]);
      gl.attachShader(program, shader);
      gl.linkProgram(program);

      infoLog = gl.getProgramInfoLog(program);
      success = gl.getProgramParameter(program, gl.LINK_STATUS);
      console.log("Shader linker info log: " + (infoLog ? infoLog : "<empty>"));

      console.log("Successfully initialized ", fragmentShaderName);

      nokia.gl.shaders[fragmentShaderName] = program;
    };

    nokia.utils.loadKernel(fragmentShaderName, fsURI, callback);
  };

  /**
   * Called when the fragment shader source code becomes available.
   * The vertex shader is assumed to be already available at
   * nokia.gl.shaders["default-vertexshader"] in compiled form.
   */
  nokia.gl.shaderOnLoad = function (fragmentShaderName, fragmentShaderSource) {

    var gl = nokia.gl.context;
    var shader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(shader, fragmentShaderSource);
    gl.compileShader(shader);

    var infoLog = gl.getShaderInfoLog(shader);
    var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    console.log("Shader compiler info log: " + (infoLog ? infoLog : "<empty>"));

    var program = gl.createProgram();
    program.name = fragmentShaderName;
    gl.attachShader(program, nokia.gl.shaders["default-vertexshader"]);
    gl.attachShader(program, shader);
    gl.linkProgram(program);

    infoLog = gl.getProgramInfoLog(program);
    success = gl.getProgramParameter(program, gl.LINK_STATUS);
    console.log("Shader linker info log: " + (infoLog ? infoLog : "<empty>"));

    console.log("Successfully initialized ", fragmentShaderName);

    nokia.gl.shaders[fragmentShaderName] = program;
  };

  /**
   * Loads and compiles the given vertex shader or fragment shader.
   *
   * @param {WebGLRenderingContext} gl the WebGL context to associate
   * the shader with
   *
   * @param {GLenum} type <tt>gl.VERTEX_SHADER</tt> or
   * <tt>gl.FRAGMENT_SHADER</tt>
   *
   * @param {String} id the ID of the DOM tree element that contains
   * the shader source code
   * 
   * @param {String} uri the URI where to load the shader source
   * code if it cannot be found from the DOM tree [optional]
   *
   * @return {WebGLShader} The compiled shader program, or 'null' in
   * case of failure
   */
  nokia.gl.setupShader = function (gl, type, id, uri) {
    var shader = gl.createShader(type);
    var shaderSource = nokia.utils.loadKernel(id, uri);
    
    gl.shaderSource(shader, shaderSource);
    gl.compileShader(shader);

    var infoLog = gl.getShaderInfoLog(shader);
    var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    console.log("Shader compiler info log: " + (infoLog ? infoLog : "<empty>"));

    return success ? shader : null;
  };

  /**
   * EXPERIMENTAL.
   */
  nokia.gl.configShaderSource = function (source, varName, newValue) {
    //var pattern = new RegExp("const int kernelWidth = [0-9]*;");
    var pattern = new RegExp("uniform vec2 resolution");
    var newSource = source.match(pattern);
    console.log(newSource);
  };

  /**
   * Creates an empty GL texture object with default attributes (no
   * mipmaps; point sampling; clamped in both directions), augmenting
   * it with metadata fields for width, height, format and name.
   * Other functions in this library assume that the metadata fields
   * are present.
   * 
   * @param {WebGLRenderingContext} gl the WebGL context to use
   *
   * @param {Integer} width the width of the texture, in pixels
   *
   * @param {Integer} height the height of the texture, in pixels
   *
   * @param {GLenum} format the internal format of the texture,
   * e.g. <tt>gl.RGBA</tt>
   *
   * @param {String} name a name to associate with the texture
   *
   * @return {WebGLTexture} the new texture object, or 'null' in
   * case of failure
   */
  nokia.gl.createTexture = function (gl, width, height, format, name)  {
    //var fmtString = WebGLDebugUtils.glEnumToString(format);
    var fmtString = "" + format;
    console.log("createTexture(gl, " + width + ", " + height + ", " + fmtString + ", '" + name + "'):");

    var texture = gl.createTexture();
    texture.width = width;
    texture.height = height;
    texture.format = format;
    texture.name = name;

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    
    return texture;
  };

  /**
   * Sets up the minimal set of vertex arrays that are needed to
   * draw a full-screen rectangle. The rectangle can be drawn by
   * <tt>gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)</tt>.
   * 
   * @param {WebGLRenderingContext} gl the WebGL context to set
   * up with the default geometry
   */
  nokia.gl.setupDefaultGeometry = function (gl) {
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Int8Array([-1, -1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 2, gl.BYTE, false, 0, 0);
    gl.enableVertexAttribArray(0);

    // DEBUG: Also create & bind an index buffer for debugging purposes.
    // This allows using gl.drawElements(gl.TRIANGLES, 2, gl.UNSIGNED_BYTE, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint8Array([0, 1, 2, 2, 1, 3]), gl.STATIC_DRAW);
  };

  /**
   * @private
   */
  nokia.gl.bindTextures = function (gl, textures) {

    var textureArray;
    if (textures.length) {
      textureArray = textures;
    } else {
      textureArray = Array.prototype.slice.call(arguments, 1);
    }
  
    for (var i=0, names = ""; i < textureArray.length; i++) {
      //names += ", '" + textureArray[i].name + "'";
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, textureArray[i]);
    }
    //console.log("  bindTextures(gl" + names + ")");
  };

  /**
   * Retrieves the pixels from the given canvas and returns them in
   * a new ImageData object.
   * 
   * @param {WebGLRenderingContext} gl the WebGL context to use
   *
   * @param {HTMLCanvasElement} canvas3d the canvas to get
   * pixels from
   * 
   * @return {ImageData} the pixels, width and height retrieved from
   * the canvas
   */
  nokia.gl.getImageDataFrom3DCanvas = function (gl, canvas3d) {
    var width = canvas3d.width;
    var height = canvas3d.height;
    
    // Initialize our dummy 2d canvas for the operation

    var canvas2d = $('#canvas2d')[0];
    canvas2d.width = width;
    canvas2d.height = height;
  
    var ctx2d = canvas2d.getContext("2d");
    ctx2d.drawImage(canvas3d, 0, 0, width, height);
  
    var origImg = ctx2d.getImageData(0, 0, width, height);
  
    console.log("nokia.gl.getImageDataFrom3DCanvas: returning " + origImg);

    return origImg;
  };

  ///////////////////////////////////////////////////////////////////////////////////////
  //
  // WebGL utils that are typically used on a per-frame basis
  //
  ///////////////////////////////////////////////////////////////////////////////////////

  /**
   * Sets the value of the given floating-point uniform. The type of
   * the uniform must be float, vec2, vec3 or vec4.
   * 
   * @param {WebGLRenderingContext} gl the WebGL context to use
   *
   * @param {WebGLProgram} program the WebGL program to set the
   * uniforms for
   *
   * @param {String} name the name of the uniform to set
   *
   * @param value an array or a variable number of arguments, for
   * a total of 1, 2, 3 or 4 numeric values
   *
   * @example
   * nokia.gl.setUniformf(gl, program, name, [0.3, 0.7, 100]);
   * nokia.gl.setUniformf(gl, program, name, 0.3, 0.7, 100);
   */
  nokia.gl.setUniformf = function (gl, program, name, value) {
    
    var values;
    if (value.length) {
      values = value;
    } else {
      values = Array.prototype.slice.call(arguments, 3);
    }

    //console.log("  setUniformf(gl, program, " + name + ", " + values.join(", ") + ")");

    try {
      var location = gl.getUniformLocation(program, name);
      if (location == -1 || location == null) {
        throw new Error("Not active in the current shader program.");
      }
    
      switch (values.length) {
      case 1: gl.uniform1f(location, values[0]);  break;
      case 2: gl.uniform2f(location, values[0], values[1]); break;
      case 3: gl.uniform3f(location, values[0], values[1], values[2]); break;
      case 4: gl.uniform4f(location, values[0], values[1], values[2], values[3]); break;
      default: gl.uniform1fv(location, values); break;
      }
    } catch (e) {
      console.log("  Warning: glSetUniformf failed to set uniform '" + name + "': " + e);
    }
  };

  /**
   * Sets the value of the given integer uniform. The type of the
   * uniform must be int, ivec2, ivec3, ivec4, or sampler.
   *
   * @param {WebGLRenderingContext} gl the WebGL context to use
   *
   * @param {WebGLProgram} program the WebGL program to set the
   * uniforms for
   *
   * @param {String} name the name of the uniform to set
   *
   * @param value an array or a variable number of arguments, for
   * a total of 1, 2, 3 or 4 numeric values
   */
  nokia.gl.setUniformi = function (gl, program, name, value) {

    var values;
    if (value.length) {
      values = value;
    } else {
      values = Array.prototype.slice.call(arguments, 3);
    }

    //console.log("  setUniformi(gl, program, " + name + ", " + values.join(", ") + ")");

    try {
      var location = gl.getUniformLocation(program, name);
      if (location == -1 || location == null) {
        throw new Error("Not active in the current shader program.");
      }

      switch (values.length) {
      case 1: gl.uniform1i(location, values[0]);  break;
      case 2: gl.uniform2i(location, values[0], values[1]); break;
      case 3: gl.uniform3i(location, values[0], values[1], values[2]); break;
      case 4: gl.uniform4i(location, values[0], values[1], values[2], values[3]);   break;
      default: throw new Error("Invalid number of parameters.");
      }
    } catch (e) {
    console.log("  Warning: glSetUniformi failed to set uniform '" + name + "': " + e);
    }
  };

  /**
   * @private
   */
  nokia.gl.clearTexture = function (gl, texture) {
    console.log("clearTexture(gl, '" + texture.name + "')");
    var w = texture.width;
    var h = texture.height;
    var fmt = texture.format;
    var bpp = (fmt==gl.ALPHA) ? 1 : 4;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, fmt, w, h, 0, fmt, gl.UNSIGNED_BYTE, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
  };
  
  /**
   * @private
   */
  nokia.gl.texImage2D = function (gl, texture, image, flipY) {

    //nokia.utils.Timer.start("  texImage2D("+texture.name+")");

    //var srcName = "'" + (image.name? image.name : image) + "'";
    //console.log("texImage2D(gl, dst = '" + texture.name + "', src = " + srcName + ", flipY = " + flipY + ")");
    gl.bindTexture(gl.TEXTURE_2D, texture);

    try {
      var fmt = texture.format;
      var w = texture.width;
      var h = texture.height;
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipY);
      if (image.width) {
        gl.texImage2D(gl.TEXTURE_2D, 0, fmt, fmt, gl.UNSIGNED_BYTE, image);
      } else {
        gl.texImage2D(gl.TEXTURE_2D, 0, fmt, w, h, 0, fmt, gl.UNSIGNED_BYTE, image);
      }
    } catch (e) {
      console.log("exception in nokia.gl.texImage2D: " + e);
      throw e;
    }

    gl.bindTexture(gl.TEXTURE_2D, null);

    //nokia.utils.Timer.elapsed("  texImage2D("+texture.name+")", true);
  };

  /**
   * Draws a screen-aligned quad consisting of two triangles.
   * Assumes that the vertex attributes, shaders and all other GL
   * state have been set up correctly.  
   *
   * This function serves as an abstraction layer for GL draw calls,
   * making it easier to switch between <tt>drawArrays</tt> and
   * <tt>drawElements</tt>, or <tt>TRIANGLE_STRIP</tt> and
   * <tt>TRIANGLES</tt>.  This is often necessary to circumvent bugs
   * in different WebGL implementations.
   *
   * @param {WebGLRenderingContext} gl the WebGL context to use
   */
  nokia.gl.drawRect = function (gl) {
    //console.log("  nokia.gl.drawRect(gl)");
    //gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_BYTE, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    //gl.flush();
  };

  /**
   * @private
   */
  nokia.gl.drawDefault = function (gl, texture) {
    //console.log("drawDefault(gl, '" + texture.name + "'):");
    //console.log("  texture size = " + texture.width + " x " + texture.height);
    //console.log("  canvas size = " + nokia.gl.width + " x " + nokia.gl.height);
    var width = texture.width;
    var height = texture.height;
    var shader = nokia.gl.shaders["default"];
    gl.useProgram(shader);
    nokia.gl.bindTextures(gl, texture);
    nokia.gl.setUniformf(gl, shader, "resolution", width, height);
    nokia.gl.setUniformi(gl, shader, "src", 0);
    nokia.gl.drawRect(gl);
  };

  /**
   * @private
   */
  nokia.gl.drawMirrored = function (gl, texture) {
    console.log("drawMirrored(gl, '" + texture.name + "'):");
    console.log("  texture size = " + texture.width + " x " + texture.height);
    console.log("  canvas size = " + nokia.gl.width + " x " + nokia.gl.height);
    var width = texture.width;
    var height = texture.height;
    nokia.gl.bindTextures(gl, texture);
    var shader = nokia.gl.shaders["mirrorX"];
    gl.useProgram(shader);
    nokia.gl.setUniformf(gl, shader, "resolution", width, height);
    nokia.gl.setUniformi(gl, shader, "src", 0);
    nokia.gl.drawRect(gl);
  };

  /**
   * @private
   */
  nokia.gl.drawBlended = function (gl, src1, src2, mask) {
    //console.log("nokia.gl.drawBlended");
    var shader = nokia.gl.shaders["zoomblend"];
    gl.useProgram(shader);
    nokia.gl.bindTextures(gl, src1, src2, mask);
    nokia.gl.setUniformf(gl, shader, "zoom", 1/src1.width, 1/src1.height, 0, 0);
    nokia.gl.setUniformi(gl, shader, "src", 0);
    nokia.gl.setUniformi(gl, shader, "src2", 1);
    nokia.gl.setUniformi(gl, shader, "mask", 2);
    nokia.gl.drawRect(gl);
  };

  /**
   * @private
   */
  nokia.gl.drawZoomed = function (gl, texture, ulx, uly, w, h) {
    //console.log("nokia.gl.drawZoomed(gl, '" + texture.name + "'):");
    //console.log("  texture size = " + texture.width + " x " + texture.height);
    //console.log("  zoom window size = " + w + " x " + h);
    var shader = nokia.gl.shaders["zoom"];
    gl.useProgram(shader);
    nokia.gl.bindTextures(gl, texture);
    var zoomFactorX = w/(texture.width*texture.width);
    var zoomFactorY = h/(texture.height*texture.height);
    var zoomOffsetX = ulx/texture.width;
    var zoomOffsetY = uly/texture.height;
    var thumbWidth = texture.width * 0.25;
    var thumbHeight = texture.height * 0.25;
    nokia.gl.setUniformf(gl, shader, "zoom", zoomFactorX, zoomFactorY, zoomOffsetX, zoomOffsetY);
    nokia.gl.setUniformf(gl, shader, "resolution", texture.width, texture.height, thumbWidth, thumbHeight);
    nokia.gl.setUniformi(gl, shader, "src", 0);
    nokia.gl.drawRect(gl);
  };

  /**
   * @private
   */
  nokia.gl.drawZoomBlended = function (gl, src1, src2, mask, invertMask, ulx, uly, w, h) {
    //console.log("nokia.gl.drawZoomBlended");
    //console.log("  src1 = ", src1.name);
    //console.log("  src2 = ", src2.name);
    //console.log("  mask = ", mask.name);
    //console.log("  zoom window = (", ulx, uly, w, h, ")");
    //console.log("  texture size = " + src1.width + " x " + src1.height);
    var shader = nokia.gl.shaders["zoomblend"];
    gl.useProgram(shader);
    nokia.gl.bindTextures(gl, src1, src2, mask);
    var zoomFactorX = w/(src1.width*src1.width);
    var zoomFactorY = h/(src1.height*src1.height);
    var zoomOffsetX = ulx/src1.width;
    var zoomOffsetY = uly/src1.height;
    var thumbWidth = src1.width * 0.25;
    var thumbHeight = src1.height * 0.25;
    //console.log("  zoom offset X,Y = " + zoomOffsetX + ", " + zoomOffsetY);
    nokia.gl.setUniformf(gl, shader, "zoom", zoomFactorX, zoomFactorY, zoomOffsetX, zoomOffsetY);
    nokia.gl.setUniformf(gl, shader, "resolution", src1.width, src1.height, thumbWidth, thumbHeight);
    nokia.gl.setUniformi(gl, shader, "invertMask", invertMask);
    nokia.gl.setUniformi(gl, shader, "src", 0);
    nokia.gl.setUniformi(gl, shader, "src2", 1);
    nokia.gl.setUniformi(gl, shader, "mask", 2);
    nokia.gl.drawRect(gl);
  };

  /**
   *
   */
  nokia.gl.renderToTextureFBO = function (gl, targetTexture, shader, uniforms) {

    var fbo = nokia.gl.textureBrushMaskFBO;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

    gl.useProgram(shader);
    var samplers = [];
    //console.log(uniforms);
    for (var name in uniforms) {
      if (uniforms[name].format > 0) {  // is it a texture?
        nokia.gl.setUniformi(gl, shader, name, samplers.length);
        samplers[samplers.length] = uniforms[name];
      } else {
        nokia.gl.setUniformf(gl, shader, name, uniforms[name]);
      }
    }
    nokia.gl.bindTextures(gl, samplers);
    //console.log("  rendering into '" + nokia.gl.textureBrushMask.name + "'");
    //console.log("  sampling from  '" + samplers[0].name + "'");
    nokia.gl.drawRect(gl);

    // Release the FBO, bind the actual framebuffer

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  };

  /**
   * @private
   */
  nokia.gl.renderToTexture = function (gl, targetTexture, shader, uniforms) {
    //console.log("nokia.gl.renderToTexture(gl, '", targetTexture.name, "', '", shader.name, "')");
    gl.useProgram(shader);
    var samplers = [];
    //console.log(uniforms);
    for (var name in uniforms) {
      if (uniforms[name].format > 0) {  // is it a texture?
        nokia.gl.setUniformi(gl, shader, name, samplers.length);
        samplers[samplers.length] = uniforms[name];
      } else {
        nokia.gl.setUniformf(gl, shader, name, uniforms[name]);
      }
    }
    samplers[samplers.length] = targetTexture;
    nokia.gl.bindTextures(gl, samplers);
    nokia.gl.drawRect(gl);
    gl.activeTexture(gl.TEXTURE0 + samplers.length - 1);
    gl.copyTexImage2D(gl.TEXTURE_2D, 0, targetTexture.format, 0, 0, nokia.gl.width, nokia.gl.height, 0);
  };

  /**
   * A convenience wrapper for readPixels.
   */
  nokia.gl.readPixels = function (gl, srcCanvas, dstPixels) {
    var width = srcCanvas.width;
    var height = srcCanvas.height;
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, dstPixels);
  };

  /**
   * 
   */
  nokia.gl.copyTexSubImage2D = function (gl, level, xoffset, yoffset, x, y, width, height) {
    console.log("copyTexSubImage2D");
    gl.copyTexSubImage2D(gl.TEXTURE_2D, level, xoffset, yoffset, x, y, width, height);
    /*
      var pixels = new Uint8Array(width*height*4);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.readPixels(x, y, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      gl.texSubImage2D(gl.TEXTURE_2D, level, xoffset, yoffset, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    */
    //gl.flush();
    //gl.texImage2D(gl.TEXTURE_2D, level, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, nokia.gl.canvas);
  };

  /**
   * @private
   */
  nokia.gl.setupRenderToTexture = function (gl, texture) {
    try {
      var fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      var fbstatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      console.log("setupRenderToTexture('" + texture.name + "')");
      if (fbstatus != gl.FRAMEBUFFER_COMPLETE) {
        throw new Error("Framebuffer status != FRAMEBUFFER_COMPLETE");
      }
      fb.width = texture.width;
      fb.height = texture.height;
      return fb;
    } catch(e) {
      console.log("exception in setupRenderToTexture: " + e);
      return null;
    }
  };

  ///////////////////////////////////////////////////////////////////////////////////////
  //
  // Private helper functions
  //
  ///////////////////////////////////////////////////////////////////////////////////////

  /**
   * Prints the WebGL context attributes to the browser console.
   *
   * @param {WebGLRenderingContext} gl the WebGL context whose
   * attributes to display
   *
   * @private
   */
  nokia.gl.printContextAttributes = function (gl) {
    if (gl != null && gl.getContextAttributes) {
      var attribs = gl.getContextAttributes();
      for (var prop in attribs) {
        console.log("attribs[" + prop + "] = " + attribs[prop] + "<br>");
      }
    }
  };

  nokia.gl.test = function(idx) {
    console.log("testing:", idx);
  };

})();

///////////////////////////////////////////////////////////////////////////////////////
//
// Public API
//
///////////////////////////////////////////////////////////////////////////////////////

nokia.glu = {

  /**
   * Creates a WebGL context for the given canvas, initializing it
   * with default geometry, shaders, textures, and other GL state.
   * The following attributes are made globally available:
   *
   * <ul>
   * <li>nokia.gl.context: the WebGL context</li>
   * <li>nokia.gl.canvas: the canvas associated with WebGL</li>
   * <li>nokia.gl.width: width of the canvas, in pixels</li>
   * <li>nokia.gl.height: height of the canvas, in pixels</li>
   * <li>nokia.gl.textureOriginal: the input image to an Effect</li>
   * <li>nokia.gl.textureFiltered: empty texture for intermediate storage in an Effect</li>
   * <li>nokia.gl.texturePainted: empty texture for storing the result of an Effect</li>
   * <li>nokia.gl.textureBrushMask: empty alpha mask texture for the Paint mode</li>
   * </ul>
   *
   * The following set of compiled and linked shader programs, indexed
   * by <tt>nokia.glu.shaders["name"]</tt>, are also made available:
   *
   * <ul>
   * <li>"default": draws a full-screen image</li>
   * <li>"mirrorX": draws a full-screen image, mirrored in X</li>
   * <li>"mirrorY": draws a full-screen image, mirrored in Y</li>
   * <li>"zoom": fills the viewport with the given sub-image</li>
   * <li>"zoomblend": same as "zoom", but with two textures blended by a per-pixel mask</li>
   * <li>"brush": updates the brush alpha mask</li>
   * <li>"debug": draws a full-screen image with a diagonal red gradient</li>
   * </ul>
   *
   * @param {HTMLCanvasElement} canvas the canvas element to get a WebGL
   * context from
   *
   * @param {HTMLImageElement/HTMLCanvasElement} image the image or canvas
   * to initialize GL textures from
   *
   * @return {WebGLRenderingContext} the WebGL context, or 'null' in
   * case of failure
   */
  createGL : function (canvas, image) { 
    return nokia.gl.setupGL(canvas, image); 
  },

  /**
   * Reuse the existing GL context.
   */
  reuseGL : function (canvas, image) {
    return nokia.gl.reuseGL(canvas, image);
  },

  /**
   * Loads and compiles the given fragment shader, links it with the
   * default vertex shader, and inserts the complete program object
   * into the <tt>nokia.gl.shaders</tt> array, indexed by the given
   * name.  The default vertex shader must be loaded and compiled
   * beforehand.
   *
   * @param {String} name the name to use for indexing the shader
   *
   * @return {WebGLProgram} the compiled and linked shader program
   */
  setupShaderProgram : function (name) {
    return nokia.gl.setupShaderProgram(nokia.gl.context, name);
  },
  
  /**
   * Clears the given texture to all zeros.
   * 
   * @param {WebGLTexture} texture the texture to clear
   */
  clearTexture : function (texture) { 
    return nokia.gl.clearTexture(nokia.gl.context, texture); 
  },

  /**
   * A convenience wrapper for <tt>texImage2D</tt> that first binds
   * the given texture object, then fills it with pixels from the
   * given Image, Canvas, ImageData or Uint8Array object, and finally
   * unbinds the texture.
   * 
   * @param {WebGLTexture} texture the texture to fill in
   *
   * @param image the source Image, Canvas, ImageData or Uint8Array
   *
   * @param {boolean} flipY 'true' to mirror the source image in the
   * vertical direction when copying it to the texture
   */
  texImage2D : function (texture, image, flipY) {
    return nokia.gl.texImage2D(nokia.gl.context, texture, image, flipY);
  },

  /**
   * Binds the given array of texture objects to the current
   * rendering context.
   * 
   * @param textures an array of WebGLTexture objects
   */
  bindTextures : function (textures) { 
    return nokia.gl.bindTextures(nokia.gl.context, textures); 
  },

  /**
   * Renders the given texture as a screen-aligned rectangle. Uses
   * the default shader <tt>nokia.gl.shaders["default"]</tt>.
   * 
   * @param {WebGLTexture} texture the texture object to draw
   */
  drawDefault : function (texture)  { 
    return nokia.gl.drawDefault(nokia.gl.context, texture); 
  },

  /**
   * Renders the given texture as a screen-aligned rectangle that is
   * mirrored in the X direction. Uses the built-in shader "mirrorX".
   * 
   * @param {WebGLTexture} texture the source texture to draw
   */
  drawMirrored : function (texture) {
    return nokia.gl.drawMirrored(nokia.gl.context, texture);
  },

  /**
   * Renders the alpha-blended combination of two textures, using an
   * alpha mask given as the third texture.  All textures must be
   * the same size. Uses the built-in shader "zoomblend".
   * 
   * @param {WebGLTexture} src1 the first source texture
   * @param {WebGLTexture} src2 the second source texture
   * @param {WebGLTexture} mask the alpha mask for blending
   */
  drawBlended : function (src1, src2, mask) {
    return nokia.gl.drawBlended(nokia.gl.context, src1, src2, mask);
  },

  /**
   * Renders the selected rectangular region of the given texture.
   * The zoom region is specified in absolute pixels in texture
   * space (not in screen space).  Uses the built-in shader "zoom".
   * 
   * @param {WebGLTexture} src the source texture to draw
   * @param {Number} ulx the upper-left X coordinate of the zoom region, in texels
   * @param {Number} uly the upper-left Y coordinate of the zoom region, in texels
   * @param {Number} w the width of the zoom region, in texels
   * @param {Number} h the height of the zoom region, in texels
   */
  drawZoomed : function (texture, ulx, uly, w, h) {
    return nokia.gl.drawZoomed(nokia.gl.context, texture, ulx, uly, w, h);
  },

  /**
   * Renders an alpha-blended combination of the selected region on
   * two textures, using an alpha mask given as the third texture.
   * The zoom region is specified in absolute pixels in texture
   * space (not in screen space).  Uses the built-in shader
   * "zoomblend".
   * 
   * @param {WebGLTexture} src1 the first source texture
   * @param {WebGLTexture} src2 the second source texture
   * @param {WebGLTexture} mask the alpha mask for blending
   * @param {Boolean} invertMask 'true' to invert the brush mask
   * @param {Number} ulx the upper-left X coordinate of the zoom region, in texels
   * @param {Number} uly the upper-left Y coordinate of the zoom region, in texels
   * @param {Number} w the width of the zoom region, in texels
   * @param {Number} h the height of the zoom region, in texels
   */
  drawZoomBlended : function (src1, src2, mask, invertMask, ulx, uly, w, h) {
    nokia.gl.drawZoomBlended(nokia.gl.context, src1, src2, mask, invertMask, ulx, uly, w, h);
  },

  /**
   * Renders a full-screen image into the given texture using the
   * given shader and its parameters.  The image is first drawn to
   * the frame buffer, then copyTexImage2D'd into the target
   * texture. (TODO: switch to using FBOs instead.)
   *
   * @param {WebGLTexture} targetTexture the texture to render into
   * @param {WebGLProgram} shader the shader program to use
   * @param {Array} uniforms a key-value list of parameter names and their values
   */
  renderToTexture : function (targetTexture, shader, uniforms) {
    nokia.gl.renderToTextureFBO(nokia.gl.context, targetTexture, shader, uniforms);
  }
};

console.log("nokia.glu:");
for (var v in nokia.glu) {
  console.log("  ", v, ": ", nokia.glu[v]);
}
