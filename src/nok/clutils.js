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
 * WebCL framework and utility functions.
 *
 * @author Tomi Aarnio
 */

goog.provide('nokia.cl');

(function ($, nokia) {

  /** @namespace */

  nokia.cl = {

    // CL attributes, indexed per context

    numContexts : 0,
    contexts : [],
    devices: [],
    cmdQueues : [],
	  kernels : [],      // nokia.cl.kernels[ctxIndex]["kernelName"]
    platformNames : [],

    // Current CL attributes

	  context : null,
	  device : null,
	  cmdQueue : null,
    ctxIndex : 0,

    // Per-image constants

    width : 0,
    height : 0,
	  bufIn : null,
	  bufOut : null,
	  dataIn : null,
	  dataOut : null,
	  globalWS : null,
    blockWidth : 16,
    blockheight : 4
  };

  /**
   * Looks up the WebCL enum that has the given value.  For example,
   * "nokia.cl.enumToString(-5)" will return "CL_OUT_OF_RESOURCES".
   */
  nokia.cl.enumToString = function (value) {
    for (var v in WebCL) {
      if (WebCL[v] === value) {
        return v;
      }
    }
  };

  /**
   * Creates and initializes the WebCL context, unless that's already
   * been done.  The context is made globally available as
   * <tt>nokia.cl.context</tt>.  A command queue is also created by
   * the name <tt>nokia.cl.cmdQueue</tt>.
   *
   * @return {Boolean} 'true' if success; 'false' if WebCL is not
   * available or could not be initialized
   */
  nokia.cl.createContext = function () {

	  // Return immediately if WebCL is not available or is already initialized
    
	  if (!window.WebCL) return false;
	  if (nokia.cl.context != null) return true;
	
	  // Use the default device (CPU/GPU) of the first available platform.
	  // Note that there may be multiple OpenCL platforms in a system, for
	  // example a GPU driver from NVIDIA and a CPU implementation by AMD.
	
	  var platforms = webcl.getPlatforms();
	  var deviceType = WebCL.DEVICE_TYPE_DEFAULT;
    for (var i=0; i < platforms.length; i++) {
      try {
        var platform = platforms[i];
        var platformName = platform.getInfo(WebCL.PLATFORM_NAME);
        console.log("nokia.cl.createContext: " + platformName + " OpenCL driver.");
        nokia.cl.platformNames[i] = platformName;
	      nokia.cl.devices[i] = platform.getDevices(deviceType)[0];  // first device of every platform
	      nokia.cl.contexts[i] = webcl.createContext(deviceType);
        nokia.cl.cmdQueues[i] = nokia.cl.contexts[i].createCommandQueue(nokia.cl.devices[i], 0);
        nokia.cl.numContexts++;
      } catch (e) {
        console.log("nokia.cl.createContext: Failed to create a command queue for platform #" + i + ": ", e);
        return false;
      }
    }

    nokia.cl.selectContext(nokia.cl.numContexts-1);
    return true;
  };

  nokia.cl.selectContext = function(index) {
    if (index >= nokia.cl.numContexts) {
      console.log("nokia.cl.selectContext: attempted to select a non-existing CL context at index ", index);
      return false;
    }
    nokia.cl.context = nokia.cl.contexts[index];
    nokia.cl.device = nokia.cl.devices[index];
    nokia.cl.cmdQueue = nokia.cl.cmdQueues[index];
    nokia.cl.ctxIndex = index;
    console.log("nokia.cl.selectContext: selected platform", index, ": ", nokia.cl.platformNames[index]);
    return true;
  };

  /**
   * Loads a kernel from the given URI and builds it for all CL
   * devices.  Creates a CL context for each device if necessary.
   *
   * @param {String} kernelURI a URI to load the kernel source code from
   * @return {Boolean} 'true' if the kernel build succeeded on all devices
   */
  nokia.cl.setupKernel = function (kernelURI) {
    var kernelSrc = nokia.utils.loadKernel("", kernelURI);
    var success = !!kernelSrc && nokia.cl.createContext();
    if (success) {
      for (var i=0; i < nokia.cl.numContexts; i++) {
        nokia.cl.selectContext(i);
        success = nokia.cl.buildKernel(kernelSrc) && success;
      }
    }
    return success;
  };

  /**
   * Builds a kernel from the given source code and stores it into
   * an array of kernels at <tt>nokia.cl.kernels[platformIndex][kernelName]</tt>.
   *
   * @param {String} kernelSrc the kernel source code
   * @param {String} kernelName optional the name of the kernel 'main()'
   * @return {Boolean} 'true' if the kernel is successfully initialized
   *
   * @example
   * var kernelSrc = nokia.utils.loadKernel("", "shaders/sobel.cl");
   * nokia.cl.buildKernel(kernelSrc, "clSobel");
   */
  nokia.cl.buildKernel = function (kernelSrc, kernelName) {

    // Initialize the array of compiled kernels on this context, if
    // this is the first kernel we're compiling on it

    nokia.cl.kernels[nokia.cl.ctxIndex] = nokia.cl.kernels[nokia.cl.ctxIndex] || [];

    // Return immediately if the given kernel already exists on the
    // current context

    if (kernelName && nokia.cl.kernels[nokia.cl.ctxIndex][kernelName]) return true;

    // Compile and link the kernel source code for the current device

    nokia.utils.Timer.start("nokia.cl.buildKernel");

    var cl = nokia.cl.context;
    var device = nokia.cl.device;
    var program = cl.createProgram(kernelSrc);
    
    try {
      program.build([device], "-Werror -cl-fast-relaxed-math");
      kernels = program.createKernelsInProgram();
    } catch (e) {}

    var buildStatus = program.getBuildInfo(device, WebCL.PROGRAM_BUILD_STATUS);
    var buildOK = (buildStatus == WebCL.SUCCESS);

    nokia.utils.Timer.elapsed("nokia.cl.buildKernel", true);

    if (!buildOK) {
      var deviceName = device.
        getInfo(WebCL.DEVICE_PLATFORM).
        getInfo(WebCL.PLATFORM_NAME);
      var buildLog = program.getBuildInfo(device, WebCL.PROGRAM_BUILD_LOG);
      var errMsg = "Failed to build WebCL program for "+deviceName+". Error " + 
            buildStatus + ": " + buildLog;
      alert(errMsg);
      console.log(errMsg);
      console.log(kernelSrc);
      return false;
    }

    // Keep track of kernels by their name

    for (var i=0; i < kernels.length; i++) {
      var kernel = kernels[i];
      var name = kernel.getInfo(WebCL.KERNEL_FUNCTION_NAME);
      nokia.cl.kernels[nokia.cl.ctxIndex][name] = kernel;
    }

    console.log("nokia.cl.kernels[ctxIndex]: ", nokia.cl.kernels[nokia.cl.ctxIndex]);

    return true;
  };

  /**
   * Set up WebCL buffers and workgroups for the given image/canvas.
   */
  nokia.cl.setupImage = function (srcCanvas, useTexture) {
    var cl = nokia.cl;
    cl.globalWS = [ srcCanvas.width, srcCanvas.height ];
    cl.setupBuffers(srcCanvas, useTexture);
  };

  /**
   * Fills in the common image-dependent arguments for the given
   * kernel.  The arguments that are common to all kernels are as
   * follows, in this order: input buffer, output buffer, image width,
   * image height.  Each kernel may also have an additional set of
   * parameters.  This function must be called after setupImage().
   */
  nokia.cl.setupKernelArgs = function (kernel) {
    kernel.setArg(0, nokia.cl.bufIn);
    kernel.setArg(1, nokia.cl.bufOut);
    kernel.setArg(2, new Uint32Array([nokia.cl.width]));
    kernel.setArg(3, new Uint32Array([nokia.cl.height]));
    nokia.cl.firstFreeArgIndex = 4;
  };

  /**
   * Copies the source image from the given 3D canvas and sets up
   * WebCL buffers accordingly.
   */
  nokia.cl.setupBuffers = function (srcCanvas, useTexture) {

    // Check that we have a valid WebCL context available
    // (although we shouldn't even be here if that's not the case)

    if (nokia.cl.context == null) {
      console.log("WebCL not available; disabling this effect.");
      return;
    }

    // Take local copies of commonly used variables

    var cl = nokia.cl;
    var ctx = nokia.cl.context;

    // Explicitly release all CL buffers before creating new ones

    if (cl.bufIn !== null && cl.bufIn.release) {
      cl.bufIn.release();
      cl.bufOut.release();
    }

    // At this point we know the image dimensions, so let's allocate
    // the input and output buffers (width * height * 4 bytes/pixel)
    // and fetch the input image from the 3D canvas. Note that the
    // input image will be UPSIDE DOWN in nokia.cl.dataIn.
 
    var bufSize = srcCanvas.width * srcCanvas.height * 4;
    if (useTexture) {
      var descriptor = { channelOrder : WebCL.RGBA, channelType : WebCL.UNORM_INT8, width: srcCanvas.width, height: srcCanvas.height };
      cl.bufIn = ctx.createImage(WebCL.MEM_READ_ONLY, descriptor);
    } else {
      cl.bufIn = ctx.createBuffer(WebCL.MEM_READ_ONLY, bufSize);
    }
    cl.bufOut = ctx.createBuffer(WebCL.MEM_WRITE_ONLY, bufSize);
    cl.bufTmp = ctx.createBuffer(WebCL.MEM_READ_WRITE, bufSize/2);  // HACK HACK
    cl.dataOut = new Uint8Array(bufSize);
    cl.dataIn = new Uint8Array(bufSize);
    nokia.utils.Timer.start("  Canvas3D -> Uint8Array (gl.readPixels)");
    nokia.gl.readPixels(nokia.gl.context, srcCanvas, cl.dataIn);
    nokia.utils.Timer.elapsed("  Canvas3D -> Uint8Array (gl.readPixels)", true);
    cl.width = srcCanvas.width;
    cl.height = srcCanvas.height;

    // Write the source image to a CL buffer object. This only needs
    // to be done when the source image is changed.

    if (useTexture) {
      nokia.utils.Timer.start("  Uint8Array -> CL Image (cl.enqueueWriteImage)");
      cl.cmdQueue.enqueueWriteImage(cl.bufIn, true, [0, 0], [cl.width, cl.height], 0, cl.dataIn);
      nokia.utils.Timer.elapsed("  Uint8Array -> CL Image (cl.enqueueWriteImage)", true);
    } else {
      nokia.utils.Timer.start("  Uint8Array -> CL Buffer (cl.enqueueWriteBuffer)");
      cl.cmdQueue.enqueueWriteBuffer(cl.bufIn, true, 0, cl.dataIn.length, cl.dataIn);
      nokia.utils.Timer.elapsed("  Uint8Array -> CL Buffer (cl.enqueueWriteBuffer)", true);
    }
  };

  /**
   * Executes the given CL kernel with the given list of arguments.
   * The common kernel arguments (input/output buffers, width, height)
   * are assumed to be already set up.
   *
   * @param kernel
   * @param args
   */
  nokia.cl.runKernel = function(kernel, args) {

    var argIndex = nokia.cl.firstFreeArgIndex;
    for (var name in args) {
      var argValue = args[name];
      kernel.setArg(argIndex, argValue);
      argIndex++;
    }
    
    var cl = nokia.cl;
    var cmdQueue = cl.cmdQueue;
    //nokia.utils.Timer.start("  CL kernel execution + readBuffer");
    cmdQueue.enqueueNDRangeKernel(kernel, 2, null, [cl.width, cl.height]);
    nokia.cl.enqueueRead(cl.bufOut, cl.dataOut);
    cmdQueue.finish();
    //nokia.utils.Timer.elapsed("  CL kernel execution + readBuffer", true);
  };

  /**
   * Enqueues the given CL kernel for execution, but returns
   * immediately instead of blocking until the execution is completed.
   */
  nokia.cl.enqueueKernel = function(kernel, args) {
    var argIndex = nokia.cl.firstFreeArgIndex;
    for (var name in args) {
      var argValue = args[name];
      kernel.setArg(argIndex, argValue);
      argIndex++;
    }
    
    var cl = nokia.cl;
    var cmdQueue = cl.cmdQueue;
    cmdQueue.enqueueNDRangeKernel(kernel, 2, null, [cl.width, cl.height]);
  };

  /**
   * 
   */
  nokia.cl.enqueueReadBuffer = function enqueueReadBuffer() {
    var cl = nokia.cl;
    var cmdQueue = cl.cmdQueue;
    cmdQueue.enqueueReadBuffer(cl.bufOut, false, 0, cl.dataOut.length, cl.dataOut); 
    cmdQueue.finish();
  };

  /**
   * Reads the entire contents of the given WebCLMemoryObject into the
   * given ArrayBufferView.  Detects whether the memory object is a
   * raw buffer or an image and uses the corresponding enqueue
   * function.
   */
  nokia.cl.enqueueRead = function enqueueRead(srcMemObject, dstArrayBufferView) {
    var cl = nokia.cl;
    var cmdQueue = cl.cmdQueue;
    var memType = srcMemObject.getInfo(WebCL.MEM_TYPE);
    var isBuffer = (memType === WebCL.MEM_OBJECT_BUFFER);
    var isImage = (memType === WebCL.MEM_OBJECT_IMAGE2D);
    
    if (isBuffer) {
      var numBytes = srcMemObject.getInfo(WebCL.MEM_SIZE);
      cmdQueue.enqueueReadBuffer(srcMemObject, false, 0, numBytes, dstArrayBufferView);
    }

    if (isImage) {
      var w = srcMemObject.getInfo().width;
      var h = srcMemObject.getInfo().height;
      cmdQueue.enqueueReadImage(srcMemObject, false, [0,0], [w,h], 0, dstArrayBufferView);
    }
  };

  /**
   * Fills the given WebCLMemoryObject with data from the given
   * ArrayBufferView.  Detects whether the memory object is a raw
   * buffer or an image and uses the corresponding enqueue function.
   */
  nokia.cl.enqueueWrite = function enqueueWrite(dstMemObject, srcArrayBufferView) {
    var cl = nokia.cl;
    var cmdQueue = cl.cmdQueue;
    var memType = dstMemObject.getMemObjectInfo(WebCL.MEM_TYPE);
    var isBuffer = (memType === WebCL.MEM_OBJECT_BUFFER);
    var isImage = (memType === WebCL.MEM_OBJECT_IMAGE2D);

    if (isBuffer) {
      var numBytes = dstMemObject.getMemObjectInfo(WebCL.MEM_SIZE);
      cmdQueue.enqueueWriteBuffer(dstMemObject, false, 0, numBytes, srcArrayBufferView);
    }

    if (isImage) {
      var w = srcMemObject.getInfo().width;
      var h = srcMemObject.getInfo().height;
      cmdQueue.enqueueWriteImage(dstMemObject, false, [0,0], [w,h], 0, srcArrayBufferView);
    }
  };

  /**
   * Feeds the processed image, contained in nokia.cl.dataOut, to a GL
   * texture.
   */
  nokia.cl.texImage2D = function(texture, flipY) {
    //nokia.utils.Timer.start("  Uint8Array -> GL texture");
    nokia.glu.texImage2D(texture, nokia.cl.dataOut, (flipY===true));
    //nokia.utils.Timer.elapsed("  Uint8Array -> GL texture", true);
  };

})(jQuery, nokia);
